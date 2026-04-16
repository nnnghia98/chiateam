const maintenanceMessage = until => {
  return `🔧 *BOT ĐANG BẢO TRÌ*

Bot hiện đã *tạm dừng hoạt động ngay từ lúc này* và sẽ không khả dụng cho đến *${until}*.

Cảm ơn mọi người đã đồng hành và sử dụng bot trong suốt thời gian qua.

Hẹn gặp lại sau khi quá trình bảo trì hoàn tất. 🙏`;
};

module.exports = maintenanceMessage;
