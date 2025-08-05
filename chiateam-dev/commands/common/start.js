const startCommand = bot => {
  bot.onText(/^\/start$/, msg => {
    bot.sendMessage(
      msg.chat.id,
      `<pre>👋 Full lệnh + cú pháp có thể dùng, ko có mà dùng = ngu:

 Command          |                   
──────────────────────────────────────────────────────
 /addme           │ Tự add vào list              
 /add             │ Add hộ vào list              
 /remove          │ Xoá khỏi list  
 /list            │ Xem list                     
 /chiateam        │ Chia team                    
 /team            │ Xem team                     
 /addtoteam1      │ Thêm vào Team A     
 /addtoteam2      │ Thêm vào Team B     
 /resetteam       │ Huỷ team         
 /resetteam2      │ Xoá member từ Team B
 /reset           │ Xóa toàn bộ list 
 /tiensan         │ Thêm tiền sân                
 /chiatien        │ Chia tiền                    
 /vote            │ Tạo vote                     
 /clearvote       │ Xóa tất cả vote
 /leaderboard     │ Xem bảng xếp hạng
 /update-leaderboard │ Cập nhật thống kê (WIN/LOSE [id1,id2,id3])
 /player-stats    │ Xem thông số chi tiết player</pre>`,
      { parse_mode: 'HTML' }
    );
  });
};

module.exports = startCommand;
