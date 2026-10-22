package main

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const s3Bucket = "blog-images"

var allowedImageTypes = map[string]bool{"image/jpeg": true, "image/png": true, "image/gif": true, "image/webp": true}

// upload: 이미지 1장을 MinIO(S3 호환) blog-images 버킷에 올리고 공개 URL 을 돌려준다. 예전 /api/upload 와 같은 검사·메시지.
func (s *server) upload(w http.ResponseWriter, r *http.Request) {
	if s.currentSession(r, w) == nil {
		jsonError(w, 401, "Unauthorized")
		return
	}
	file, hdr, err := r.FormFile("file")
	if err != nil {
		jsonError(w, 400, "No file provided")
		return
	}
	defer file.Close()
	ctype := hdr.Header.Get("Content-Type")
	if !allowedImageTypes[ctype] {
		jsonError(w, 400, "File type not allowed. Use JPEG, PNG, GIF, or WebP.")
		return
	}
	maxBytes := s.cfg.uploadMaxMB * 1024 * 1024
	if float64(hdr.Size) > maxBytes {
		jsonError(w, 400, fmt.Sprintf("File too large (%.1fMB). Maximum %.0fMB.", float64(hdr.Size)/1024/1024, maxBytes/1024/1024))
		return
	}
	data, err := io.ReadAll(file)
	if err != nil {
		jsonError(w, 400, "No file provided")
		return
	}
	// JS: file.name.split('.').pop()
	parts := strings.Split(hdr.Filename, ".")
	ext := parts[len(parts)-1]
	key := fmt.Sprintf("uploads/%d-%s.%s", time.Now().UnixMilli(), uuidV4(), ext)
	if err := s.s3Put(r.Context(), key, data, ctype); err != nil {
		jsonError(w, 500, "Upload failed")
		return
	}
	writeJSON(w, 200, map[string]string{"url": s.cfg.s3Endpoint + "/" + s3Bucket + "/" + key})
}

// s3Put 은 path-style PutObject 를 AWS SigV4(us-east-1)로 서명해 보낸다. SDK 없이 MinIO 에 올리기 위한 최소 구현이다.
func (s *server) s3Put(ctx context.Context, key string, body []byte, ctype string) error {
	ep, err := url.Parse(s.cfg.s3Endpoint)
	if err != nil {
		return err
	}
	canonPath := "/" + s3Bucket + "/" + awsEscapePath(key)
	now := time.Now().UTC()
	amzDate := now.Format("20060102T150405Z")
	day := now.Format("20060102")
	sum := sha256.Sum256(body)
	payloadHash := hex.EncodeToString(sum[:])

	req, err := http.NewRequestWithContext(ctx, "PUT", ep.Scheme+"://"+ep.Host+canonPath, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.URL.RawPath = canonPath
	req.ContentLength = int64(len(body))
	req.Header.Set("Content-Type", ctype)
	req.Header.Set("X-Amz-Date", amzDate)
	req.Header.Set("X-Amz-Content-Sha256", payloadHash)

	signed := "content-type;host;x-amz-content-sha256;x-amz-date"
	canonReq := strings.Join([]string{
		"PUT", canonPath, "",
		"content-type:" + ctype,
		"host:" + ep.Host,
		"x-amz-content-sha256:" + payloadHash,
		"x-amz-date:" + amzDate,
		"",
		signed,
		payloadHash,
	}, "\n")
	scope := day + "/us-east-1/s3/aws4_request"
	crHash := sha256.Sum256([]byte(canonReq))
	toSign := "AWS4-HMAC-SHA256\n" + amzDate + "\n" + scope + "\n" + hex.EncodeToString(crHash[:])
	k := hmacSHA256([]byte("AWS4"+s.cfg.s3SecretKey), day)
	k = hmacSHA256(k, "us-east-1")
	k = hmacSHA256(k, "s3")
	k = hmacSHA256(k, "aws4_request")
	sig := hex.EncodeToString(hmacSHA256(k, toSign))
	req.Header.Set("Authorization", fmt.Sprintf("AWS4-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s", s.cfg.s3AccessKey, scope, signed, sig))

	res, err := s.http.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode/100 != 2 {
		b, _ := io.ReadAll(io.LimitReader(res.Body, 512))
		return fmt.Errorf("s3 put %s: %s", res.Status, b)
	}
	return nil
}

func hmacSHA256(key []byte, data string) []byte {
	m := hmac.New(sha256.New, key)
	m.Write([]byte(data))
	return m.Sum(nil)
}

// awsEscapePath 는 SigV4 규칙대로 / 를 뺀 비예약 문자 외 전부를 %XX 로 바꾼다.
func awsEscapePath(p string) string {
	var b strings.Builder
	for _, c := range []byte(p) {
		if c >= 'A' && c <= 'Z' || c >= 'a' && c <= 'z' || c >= '0' && c <= '9' || c == '-' || c == '_' || c == '.' || c == '~' || c == '/' {
			b.WriteByte(c)
		} else {
			fmt.Fprintf(&b, "%%%02X", c)
		}
	}
	return b.String()
}
