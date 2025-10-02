const maintenanceMessage = until => {
  return `🔧 *BOT ĐANG BẢO TRÌ*

Bot hiện tại đang trong quá trình bảo trì và sẽ không hoạt động cho đến *${until}*.

Vui lòng thử lại sau. Xin lỗi vì sự bất tiện này! 🙏`;
};

module.exports = maintenanceMessage;
