# Bản tử nghiệm ứng dụng xác thực mã hóa đơn điện tử và mã số thuế doanh nghiệp

Ứng dụng được phát triển nhằm giúp người dùng dễ dàng xác thực mã hóa đơn điện tử và mã số thuế doanh nghiệp một cách nhanh chóng và chính xác.

Ứng dụng giả lập thao tác người dùng trên trình duyệt web, tự động điền thông tin và gửi yêu cầu xác thực đến các dịch vụ của Tổng cục Thuế Việt Nam. Kết quả xác thực sẽ được hiển thị ngay trên giao diện người dùng.

Để tải về dùng, sử dụng hoặc đóng góp vào dự án, bấm vào [đây](https://downgit.github.io/#/home?url=https://github.com/khanhchungoc/vat-validator/tree/main/electron)

## GitHub Release

Quy trình phát hành:

1. Cập nhật `version` trong `package.json`.
2. Commit và push lên `main`.
3. Trên GitHub, vào `Releases` > `Draft a new release`.
4. Tạo tag dạng `v1.0.1` hoặc chọn tag đã có.
5. Publish release.

Sau khi release được publish, GitHub Actions sẽ:

- build bản Windows unpacked
- nén toàn bộ thư mục `release/` thành file `.zip`
- đính kèm file `.zip` vào GitHub Release
