export interface PlayerConfig {
  id: string;
  name: string;           // Tên chính, e.g. "Nguyễn Văn Bravo"
  subNames: string[];     // Các tên viết tắt/biệt danh, e.g. ["Bravo", "Bravo3", "bravo2"]
  telegramHandle: string; // Telegram handle, e.g. "@khanhtaquoc" (không bắt buộc)
  jerseyNumber: number;   // Số áo, e.g. 10
}
