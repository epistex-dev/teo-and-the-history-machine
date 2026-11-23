# M0b, hành động 1: kiểm chứng `intro`, `saturnalia`, `yule`, `mistletoe`, `bethlehem`, `dec25`, `nicholas`

Phạm vi: bảng chương và mục 7 của `story/bible.md` (HEAD `d64133e`), cùng ô `custom` trong `story/minigames.json`. Ngày kiểm: 2026-11-17.

Ký hiệu: **✔** = đã mở trang và thấy đúng cụm trích dẫn (cụm giữ nguyên ngôn ngữ gốc để đối chiếu). **○** = chỉ thấy đoạn trích tìm kiếm hoặc không đọc được trọn; không dùng trong Sổ tay. Trạng thái: vững / tranh cãi / truyền thuyết / theo Kinh Thánh / thiếu nguồn. Wikipedia chỉ dùng để lần nguồn, không trích. Blog cá nhân (Roger Pearse) không thuộc nhóm nguồn nhận trong R6 nên chỉ ghi ○ hoặc dùng làm bản chép văn bản đã có chỗ khác.

## 1. Kết quả theo chương

| Chương | Kết luận | Nhãn và mốc |
|---|---|---|
| `intro` | OK | khung, không mốc |
| `saturnalia` | OK (không cần sửa bible; có ghi chú nguồn) | Cổ, “ít nhất từ thế kỷ 1 TCN” đúng |
| `yule` | Cần sửa bible (một câu) | KT †, “khoảng 725” đúng; thêm “Snorri kể” |
| `mistletoe` | OK (thêm một dòng “không dùng” về Pliny) | DG †, 1784 đúng |
| `bethlehem` | Cần sửa bible (hai chỗ) | KT; “thế kỷ 1” đúng cho văn bản Tin Mừng, ghi “cuối thế kỷ 1” |
| `dec25` | Cần sửa bible (hai chỗ nhỏ) | KT; 354 giữ, thêm chú thích 336 |
| `nicholas` | Cần sửa bible và `minigames.json` | KT; “khoảng 700” chỉ giữ kèm “tranh cãi” |

## 2. Dòng bible nói quá bằng chứng, kèm câu sửa

1. **`nicholas`, ô Ra và câu an toàn: “sử sách chỉ chắc rằng ngài là giám mục thành Myra thế kỷ 4”.** Nguồn đã mở nói điều chắc là ba việc khác: sự tôn kính bắt đầu ở Myra từ thế kỷ 4; ngài mất ngày 6/12 của một năm không rõ; hài cốt về Bari năm 1087 (“This is about all we know with certainty”). Không có tiểu sử cùng thời. **Sửa:** “Nhiều chuyện kể về Thánh Nicôla, nhưng sử sách chỉ chắc rất ít: ngài được tôn kính ở Myra từ thế kỷ 4, mất ngày 6/12 (không rõ năm), hài cốt về Bari năm 1087.” Ô Ra: “Chỉ chắc việc tôn kính ở Myra từ thế kỷ 4; túi vàng là truyền thuyết.”
2. **`nicholas`, `minigames.json` ô `custom`: “only his role as bishop of Myra is certain; no window is shown because that detail awaits M0b”.** Cùng lý do mục 1. Chi tiết cửa sổ nay đã xác nhận (xem N5), nên cho phép nêu. **Sửa:** “Legend ('people say', disputed): St Nicholas secretly threw gold into a poor man's house through a window at night for three daughters' dowries; only the cult at Myra, 6 December and the relics at Bari (1087) are firm.” Ô `resolve` “three bags landed in three different yards” là luật chơi, giữ được, nhưng Sổ tay phải nói rõ trong truyện ba túi vào **cùng một cửa sổ**.
3. **`nicholas`, Mốc “khoảng 700 (tiểu sử đầu tiên)”.** Niên đại của tiểu sử Michael tranh cãi: c.700 (Lendering, Cioffari), 710–720 (một trang St Nicholas Center), 814–843 (Anrich). **Sửa:** giữ nhãn KT; Mốc ghi “khoảng 700 (tranh cãi: 700–843)”; chú thích dòng thời gian cần ghi “tranh cãi”. Nếu người viết muốn mốc không cãi được, dùng “thế kỷ 4” cho việc tôn kính (không phải tiểu sử), nhưng bible đã định Mốc theo bản ghi sớm nhất của truyện nên không khuyến nghị.
4. **`nicholas`, Quạ Đồn “ngài sinh năm 280 và tát Arius ở Công đồng”.** Giữ giọng (chưa ai chứng minh). Công đồng Nicêa không phải “sử thật” mà cũng không phải bịa hoàn toàn: có nguồn muộn (Theodore the Lector khoảng 515), sử gia nghi ngờ (Britannica 1911). Trang HĐGMVN (https://hdgmvietnam.com/chi-tiet/ngay-06-thang-12-thanh-nicola-xu-bari-giam-muc-thanh-myra) viết như sự thật “Được trả tự do năm 325, ngài tham dự Công đồng Nicêa”: không chép.
5. **`yule`, câu an toàn “Yule là tên mùa giữa đông của người German”.** Nguồn: “a midwinter festival observed by certain pre-Christian Germanic societies”. **Sửa:** “của một số cộng đồng German thời trước Kitô giáo”.
6. **`yule`, “Heimskringla (thế kỷ 13) kể lễ ba ngày”.** Cần nêu độ muộn: Heimskringla viết khoảng 1230, gần 300 năm sau vua Hákon (934–961). **Sửa:** “Snorri Sturluson (khoảng 1230) kể rằng, trước thời vua Hákon (luật Yule của vua ấy, chương 15), Yule kéo dài ba ngày; nguồn muộn nên có độ ngờ.”
7. **`yule`, “Bản ghi sớm nhất: Bede”.** wordorigins viết “attested to as early as 726”, ULL ghi “In 725 he wrote ... De temporum ratione”. Một nguồn blog nói lịch Gothic có “fruma jiuleis” (○, không dùng). **Sửa:** “Một trong những bản ghi sớm nhất, và là bản sớm nhất mà nguồn đã mở nêu cho tên tiếng Anh: Bede, khoảng 725.” Không nói “sớm nhất của mọi ngôn ngữ”.
8. **`bethlehem`, câu an toàn “chuồng, bò lừa, ba vua là những chi tiết truyền thống thêm vào về sau”.** Chắc chắn: Luca 2 và Mátthêu 2 không nhắc con bò, con lừa nào (“no animals at all”) và bản NPD không có chữ “chuồng” (hai nguồn hiện đại bất đồng về chuồng, B4b), Mátthêu không nêu số nhà chiêm tinh và họ vào “nhà” (house). Mốc thời gian: vua đầu thế kỷ 3 (Tertullianô); số ba có ba mốc (BAR thế kỷ 2, HĐGMVN và Origênê thế kỷ 3, Yale cuối 3 hoặc đầu 4; B15); tên Melchior, Gaspard, Balthazar có ba mốc (HĐGMVN thế kỷ 8, Yale thế kỷ 6, BAR thế kỷ 5; B22); hình bò và lừa bên máng cỏ thế kỷ 4 (B12). Chuồng: thiếu nguồn về thời điểm. **Sửa:** “Luca chỉ nói máng cỏ và không có chỗ trong nhà trọ. Luca 2 và Mátthêu 2 không nhắc con bò, con lừa nào, và không có chữ ‘chuồng’. Mátthêu kể các nhà chiêm tinh, không nêu số lượng và không gọi họ là vua; ‘Ba Vua’ là truyền thống về sau.”
9. **`bethlehem`, Mốc “thế kỷ 1”.** Đúng cho thời viết Tin Mừng (“late first century”), không phải thời sự kiện (sinh khoảng 6–4 TCN theo Britannica; Hêrôđê mất năm 4 TCN, Quirinius làm legate 6–12 CE, nên hai tường thuật khó khớp). **Sửa:** ô Mốc “cuối thế kỷ 1 (thời viết Tin Mừng)”, dòng thời gian không được hiểu là năm Chúa sinh.
10. **`dec25`, “danh sách soạn từ 336”.** History Today viết như chắc (“The first recorded celebration of 25 December doesn't arrive until 336”), Connell: “the earliest extant evidence for Christmas on December 25, in 336 in Rome”, Liverpool: “It's generally thought that this calendar was first produced in 336”. 336 là suy luận về năm biên soạn danh sách; bản còn lại là bản đặt làm năm 354. **Sửa:** Mốc giữ 354, chú thích “lịch 354, danh sách được cho là có từ 336”.
11. **`dec25`, “Sol Invictus”.** Chỉ NatGeo ngầm cho rằng lễ mặt trời có trước (lập năm 274); bản ghi trực tiếp duy nhất là mục “N INVICTI CM XXX” nằm ngay trong lịch 354, cùng tài liệu với lễ Kitô. Hijmans: lễ có thể được lập sau lễ Kitô (“purely conjectural”). NatGeo nói lễ do Aurelian lập năm 274, nhưng Penelope chỉ nói “the presumption is that Natalis Invicti refers to the birthday of the Invincible Sun”. **Sửa:** Sổ tay không dùng “thay thế lễ mặt trời” và không dùng năm 274; chỉ nói “cùng ngày, chưa rõ cái nào có trước”.
12. **`dec25`, ô `custom` “25 March plus nine months”.** Nguồn đã mở chỉ viết “calculated from 25 March, the date of the Annunciation” (History Today), không viết “chín tháng”. Chín tháng là phép cộng của game, đúng số học nhưng không phải lời nguồn. **Sửa:** chấp nhận ở mini game nếu Sổ tay chỉ nói “tính từ 25/3”.
13. **Cảnh báo nguồn tiếng Việt (không chép):** Tổng Giáo phận Hà Nội (https://www.tonggiaophanhanoi.org/tim-hieu-le-giang-sinh-va-cac-bieu-tuong-lien-quan/ ✔: “Đến năm 354, Đức Giáo Hoàng Li-bê-ri-ô công bố và ấn định ngày 25 tháng 12 là ngày chính thức để cử hành lễ Giáng sinh”) và báo Công giáo và Dân tộc (https://www.cgvdt.vn/le-giang-sinh-trong-lich-su-hoi-thanh_a22565 ✔: “Đức Giáo Hoàng Liberio đã công bố ngày 25.12 là ngày chính thức ... thay thế cho ngày lễ tôn vinh thần mặt trời”) đều nói quá. Nguồn học thuật chỉ có một lễ Ambrose kể lại, ghi 353 hoặc 354, và không có năm 25/12 trong lời kể.
14. **Tên riêng (bible mục 10):** “Libêriô, M0b xác nhận” không đúng nguyên văn: không tìm thấy trang hdgmvietnam.com nào viết tên này. Dạng “Libêriô” có ở Tổng Giáo phận Sài Gòn. **Sửa:** ghi nguồn Tổng Giáo phận Sài Gòn thay HĐGMVN. Xem mục 3.

## 3. Tên riêng

| Tên | Kết quả | Nguồn |
|---|---|---|
| **Libêriô** | Dạng liền ✔ ở Tổng Giáo phận Sài Gòn; chưa tìm thấy ở HĐGMVN. Dạng khác: Li-bê-ri-ô (Hà Nội, có gạch nối), Liberio (cgvdt.vn). Giữ “Libêriô” chỉ ở dòng “không chép”. | https://tgpsaigon.net/bai-viet/ngay-5-8-le-cung-hien-den-tho-duc-ba-maria-78437 ✔ “Đức Giáo Hoàng Libêriô” |
| **Luca** | Xác nhận. | https://hdgmvietnam.com/chi-tiet/ngay-18-thang-10-thanh-luca-tac-gia-sach-tin-mung-thay-thuoc-bon-mang-cac-nghe-si ✔ “Thánh Luca” |
| **Mátthêu** | Dạng liền ✔ ở VietCatholic: “Tin Mừng Mátthêu cho biết Đức Giêsu ra đời tại Bêlem, miền Giuđê, thời vua Hêrôđê trị vì”. Trang HĐGMVN đã mở chỉ viết “Mt” hoặc dạng NPD “Mát-thêu”. | https://www.vietcatholic.net/News/Html/287821.htm ✔ |
| **Hêrôđê, Bêlem, Giuđê** | Xác nhận dạng liền ở HĐGMVN. | https://hdgmvietnam.com/chi-tiet/ngoi-sao-dan-duong-6-1-2013-chua-nhat-chua-hien-linh--34628 ✔ “Khi Ðức Giêsu ra đời tại Bêlem, miền Giuđê, thời vua Hêrôđê trị vì”; https://hdgmvietnam.com/chi-tiet/bai-giang-duc-thanh-cha-le-dem-giang-sinh-53147 ✔ “ở Bêlem, nơi Đức Maria và Thánh Giuse” |
| **Nicôla** | Xác nhận. | https://hdgmvietnam.com/chi-tiet/ngay-06-thang-12-thanh-nicola-xu-bari-giam-muc-thanh-myra ✔ |
| Dạng gạch nối | Chỉ khi trích NPD. | https://hdgmvietnam.com/chi-tiet/le-chua-hien-linh-ba-vua-cac-dao-si-hay-cac-nha-chiem-tinh--54255 ✔ “Khi Đức Giê-su ra đời tại Bê-lem, miền Giu-đê, thời vua Hê-rô-đê trị vì” |

## 4. `intro` (khung, không nhãn)

Mini game `custom`: “none: tutorial” (lau máy), không có điểm lịch sử.

| # | Điểm | Trạng thái | Nguồn ✔ và cụm trích |
|---|---|---|---|
| I1 | Giáng Sinh là sự pha trộn nhiều lớp; sử gia tranh luận lớp nào đến trước | tranh cãi | https://www.nationalgeographic.com/history/article/christmas-jesus-birthday-ancient-rome-saturnalia-sol-invictus : “The choice reflected a mix of religious reasoning, symbolic association, and a Roman calendar crowded with midwinter festivals.” https://doi.org/10.1017/s0009640712001941 : “traditionally crystallized around two competing approaches, known as the "History of Religions Theory" and the "Calculation Theory"” và “reveal the need for a more nuanced approach” (chỉ tóm tắt) |
| I2 | Đến thế kỷ 4, 25/12 là ngày chủ yếu ở phía Tây | vững | NatGeo: “By the 4th century, December 25 had emerged as the dominant date in the Latin West.” |
| I3 | Tèo đoán “Giáng Sinh là lễ La Mã đổi tên” | lời đoán của Tèo, không xác nhận | NatGeo: “As the basis for Christmas, Saturnalia is an imperfect candidate.” |

**Nhãn và mốc:** khung, không cần. **Bible:** OK.

### Sổ tay `intro`

**Thẻ:**

> Giáng Sinh không có một nguồn duy nhất. Đó là sự pha trộn nhiều lớp từ nhiều thời và nhiều nơi.
> Các nhà sử học vẫn tranh luận lớp nào đến trước.

**Đầy đủ:**

- **Sự thật.** Đến thế kỷ 4, ngày 25/12 đã là ngày chủ yếu ở phía Tây đế quốc La Mã; lựa chọn ấy pha lý lẽ tôn giáo, biểu tượng và một lịch La Mã dày đặc các lễ giữa đông. https://www.nationalgeographic.com/history/article/christmas-jesus-birthday-ancient-rome-saturnalia-sol-invictus
- **Truyền thuyết.** Không có ở chương này.
- **Theo Kinh Thánh / theo truyền thống.** Không có ở chương này.
- **Tranh cãi (cả hai phía).** Một hướng giải thích bằng ảnh hưởng của các lễ ngoại giáo (“lịch sử tôn giáo”); hướng kia bằng phép tính ngày của Kitô hữu thời đầu (“tính toán”). Bài tổng quan năm 2012 cho rằng cả hai cần nhìn tinh tế hơn: giữ ảnh hưởng giữa các tôn giáo nhưng chú ý hơn đến lối tính niên đại của người xưa. https://doi.org/10.1017/s0009640712001941

## 5. `saturnalia` (nhãn Cổ, mốc “ít nhất từ thế kỷ 1 TCN”)

**Nhãn và mốc: xác nhận.** Cicero nhắc Saturnalia trong bài Catilinarian 3, đọc “in December 63 B.C.” (https://www.attalus.org/cicero/catilina3.html ✔: “the city fired on the feast of Saturnalia”; cùng đoạn ở https://lexundria.com/cic_cat/3/y ✔: “the city be burnt at the Saturnalia”). Livy (bản dịch Loeb trên Perseus) kể lễ được lập khi cung hiến đền Saturnus; chú thích ghi 497 TCN. Vì Livy thuật lại truyền thống về một thời xa hơn, và ghi chú Loeb cho rằng lễ này “probably originated earlier than Livy thought”, “ít nhất từ thế kỷ 1 TCN” là cận dưới an toàn. Không viết “bản ghi sớm nhất”.

| # | Điểm | Trạng thái | Nguồn ✔ và cụm trích |
|---|---|---|---|
| S1 | Lễ chính thức bắt đầu 17/12 | vững | https://penelope.uchicago.edu/encyclopaedia_romana/calendar/saturnalia.html : “The Saturnalia officially was celebrated on December 17 (XVI Kal. Jan.)”. https://www.britannica.com/topic/Saturnalia-Roman-festival : “Originally celebrated on December 17” |
| S2 | Dài nhất đến 23/12; độ dài từng thời khác nhau | vững; hai nguồn kể diễn tiến khác nhau | Penelope: “in Cicero's time, lasted seven days (counting inclusively), from December 17 to 23. Augustus limited the holiday to three days ... and Caligula extended it to five”. Britannica: “extended first to three and eventually to seven days”. Hai nguồn đảo thứ tự; Sổ tay chỉ nói “vài ngày, dài nhất đến 23/12”. NatGeo: “even in its longest form, it ended on December 23” |
| S3 | Nghỉ việc, nới quy tắc, đảo thứ bậc | vững | Penelope: “restrictions were relaxed and the social order inverted”; “Slaves were permitted to use dice and did not have to work” |
| S4 | Chủ tớ đổi vai (nô lệ mặc áo chủ, được phục vụ bữa ăn) | vững | Penelope: “Slaves were treated as equals, allowed to wear their masters' clothing, and be waited on at meal time” |
| S5 | Một “vua” cho bữa tiệc | vững, nhưng tên “Lord of Misrule” là cách gọi của Penelope | Penelope: “Within the family, a Lord of Misrule was chosen, a role once occupied by a young Nero” (dẫn Tacitus, Annals XIII.15). Sổ tay nói “vua của bữa tiệc” |
| S6 | Tặng quà: nến sáp và tượng nhỏ | vững; lý do tặng nến là phỏng đoán | Penelope: “presentation of gifts, particularly wax candles (cerei), perhaps to signify the returning light after the solstice, and sigillaria”; “small earthenware figurines (sigillaria) that were sold then and given as gifts”. Không nêu lý do tặng nến |
| S7 | Saturnalia không rơi vào 25/12 và không phải lễ mặt trời | vững | NatGeo: “Saturnalia did not fall on December 25 ... was not a solstice celebration”; “agricultural renewal and the mythical Golden Age of Saturn, not the rebirth of the sun”. Bible dòng Quạ Đồn “Saturnalia vào 25/12” (sai) đúng |
| S8 | Lễ có truyền thống rất cổ | theo truyền thống | https://www.perseus.tufts.edu/hopper/text?doc=Perseus%3Atext%3A1999.02.0151%3Abook%3D2%3Achapter%3D21 : “a temple to Saturn was dedicated and the Saturnalia was established as a festal day”; chú thích: “As an old Italic feast it probably originated earlier than Livy thought”. https://www.perseus.tufts.edu/hopper/text?doc=Perseus%3Atext%3A1999.02.0152%3Abook%3D22%3Achapter%3D1 : “throughout the City for a day and a night 'Saturnalia' was cried”; chú thích: “established as an annual festival in connexion with the dedication of the temple of Saturn on December 19th, 497 B.C.” |
| S9 | Giáng Sinh thế chỗ Saturnalia | tranh cãi | Có: Penelope “by the middle of the fourth century AD, its festivities were becoming absorbed in the celebration of Christmas”. Không: NatGeo “As the basis for Christmas, Saturnalia is an imperfect candidate” |
| S10 | Tầm gửi trong Saturnalia | thiếu nguồn | https://circulatingnow.nlm.nih.gov/2024/12/23/mistletoe-tradition-and-trials/ ✔ chỉ khẳng định “a tradition that originated in Roman times for celebrations of Saturnalia”, không dẫn bằng chứng trong câu ấy; trang Penelope không có chữ mistletoe. Không dùng |
| S11 | Tèo khoe “Yule là Saturnalia của người Bắc Âu” | thiếu nguồn | Không nguồn nào đã mở coi hai lễ là một; Cúc Cu hỏi “Nguồn đâu?”, không xác nhận |

**Mini game `custom` (“role reversal ... choosing a feast 'king'”):** đúng (S4, S5).

### Sổ tay `saturnalia`

**Thẻ:**

> Từ 17/12, người La Mã mừng Saturnalia: nghỉ việc, chủ tớ đảo vai, tặng nến và tượng nhỏ.
> Lễ chấm dứt muộn nhất ngày 23/12, không phải 25/12.
> Giáng Sinh có thay chỗ lễ này hay không thì sử gia chưa đồng ý.

**Đầy đủ:**

- **Sự thật.**
  - Lễ chính thức bắt đầu ngày 17/12; lúc dài nhất kéo đến 23/12, và độ dài thay đổi theo thời. https://penelope.uchicago.edu/encyclopaedia_romana/calendar/saturnalia.html ; https://www.britannica.com/topic/Saturnalia-Roman-festival
  - Trong lễ, quy tắc nới lỏng và thứ bậc đảo ngược: nô lệ được nghỉ việc, được mặc áo chủ và được phục vụ bữa ăn; trong nhà người ta chọn một “vua” cho bữa tiệc. https://penelope.uchicago.edu/encyclopaedia_romana/calendar/saturnalia.html
  - Quà thường gặp là nến sáp và tượng đất nung nhỏ (sigillaria). https://penelope.uchicago.edu/encyclopaedia_romana/calendar/saturnalia.html
  - Saturnalia không rơi vào 25/12 và không phải lễ mặt trời; chủ đề là mùa màng và thời hoàng kim của thần Saturnus. https://www.nationalgeographic.com/history/article/christmas-jesus-birthday-ancient-rome-saturnalia-sol-invictus
  - Cicero nhắc Saturnalia trong bài phát biểu tháng 12 năm 63 TCN. https://www.attalus.org/cicero/catilina3.html
- **Truyền thuyết.** Không có ở chương này.
- **Theo truyền thống.** Sử gia Livy kể lễ được lập cùng lúc với việc cung hiến đền Saturnus; chú thích bản dịch ghi 497 TCN và nói lễ này có lẽ có từ sớm hơn. https://www.perseus.tufts.edu/hopper/text?doc=Perseus%3Atext%3A1999.02.0151%3Abook%3D2%3Achapter%3D21
- **Tranh cãi.** Một nguồn nói đến giữa thế kỷ 4 các nghi thức của Saturnalia dần hòa vào Giáng Sinh; nguồn khác nói Saturnalia là “ứng viên không hợp” làm nền cho Giáng Sinh vì không rơi vào 25/12 và không mang hình ảnh ánh sáng. https://penelope.uchicago.edu/encyclopaedia_romana/calendar/saturnalia.html ; https://www.nationalgeographic.com/history/article/christmas-jesus-birthday-ancient-rome-saturnalia-sol-invictus

## 6. `yule` (nhãn KT †, mốc “khoảng 725”)

**Nhãn và mốc: giữ.** Bede, De temporum ratione ch. 15: ULL (https://www.ull.es/revistas/index.php/fortvnatae/en/article/view/3449 ✔) “In 725 he wrote an longer version, De temporum ratione”; wordorigins ✔ “attested to as early as 726 by Bede”. † đúng: bản ghi là của một tu sĩ Kitô giáo, và nguồn về nghi lễ rất muộn. Chương ghi rõ tên, không dựng nghi lễ.

| # | Điểm | Trạng thái | Nguồn ✔ và cụm trích |
|---|---|---|---|
| Y1 | Bede ghi tên tháng Giuli cho cả tháng 1 và tháng 12 | vững (đúng nội dung bản ghi) | https://www.monumenta.ch/latein/text.php?rumpfid=Beda+Venerabilis%2C+De+Temporum+Ratione%2C+++15&tabelle=Beda_Venerabilis : “Primusque eorum mensis, quem Latini Ianuarium vocant, dicitur Giuli”; “December Giuli, eodem quo Ianuarius nomine, vocatur”; “Menses Giuli a conversione solis in auctum diei, quia unus eorum praecedit, alius subsequitur, nomina accipiunt” |
| Y2 | Bede: năm mới bắt đầu 25/12; đêm ấy gọi là Modranicht (“đêm của các bà mẹ”); lý do là phỏng đoán của ông | vững (lời Bede), lý do là phỏng đoán | cùng trang: “Incipiebant autem annum ab octavo Calendarum Ianuariarum die, ubi nunc natale Domini celebramus”; “gentili vocabulo Modranicht, id est, matrum noctem, appellabant, ob causam, ut suspicamur, ceremoniarum quas in ea pervigiles agebant” |
| Y3 | geola và jól có họ hàng nhưng không phải cha con | vững | https://www.wordorigins.org/big-list-entries/yule : “cognate with, but apparently not descended from, the Old Norse jól”; cũng nêu nghi vấn “it seems unlikely that two months would bear the same name” |
| Y4 | Yule của người German cổ | vững | https://www.scandinavianarchaeology.com/from-jol-to-yule/ : “a midwinter festival observed by certain pre-Christian Germanic societies. Each had a slightly different name for the event: geol in Old English, jiuleis in Gothic, and jól in Old Norse” |
| Y5 | Yule ba ngày | truyền thuyết (nguồn muộn) | https://www.gutenberg.org/cache/epub/598/pg598.txt (bản dịch tiếng Anh Heimskringla, mục “15. HAKON SPREADS CHRISTIANITY”) : “Before him, the beginning of Yule, or the slaughter night, was the night of mid-winter (Dec. 14), and Yule was kept for three days thereafter.” Cụm “(Dec. 14)” là chú thích của người dịch; scandinavianarchaeology nói Snorri dùng lịch khác nên không đưa ngày. Cùng bài: “According to this saga, the pagan jól was a three-day event commencing at midwinter”; “Heimskringla was composed around 1230 AD—nearly 300 years after Hákon's death. There is always a certain doubt around the accuracy of Snorri Sturluson's information about the pagan era” |
| Y6 | Ít biết về nghi lễ; lễ có thể khác nhau theo vùng | vững | scandinavianarchaeology: “References to jól in Old Norse literature are sparse”; “it is possible that it looked quite different when observed in different areas” |
| Y7 | Khúc củi Yule, “bánh xe mặt trời”, chi tiết nghi lễ | thiếu nguồn | không nguồn nào mở được; bible đã loại, kể cả hình vẽ |
| Y8 | Có bản ghi sớm hơn Bede (lịch Gothic, “fruma jiuleis”) | thiếu nguồn | ○ chỉ một blog: https://roger-pearse.com/weblog/2019/12/16/the-first-mention-of-yule-the-gothic-liturgical-calendar-in-the-codex-argenteus/ (nêu tranh luận về cách đọc). Không dùng trong Sổ tay |

**Mini game `custom`:** đúng (Y5, Y6). Ba ngày và ba đêm của game là cách chơi, Sổ tay chỉ nói “ba ngày”.

### Sổ tay `yule`

**Thẻ:**

> Yule là tên mùa giữa đông của một số cộng đồng German thời trước Kitô giáo.
> Một trong những bản ghi sớm nhất là của Bede, khoảng năm 725: tháng 12 và tháng 1 đều gọi là Giuli.
> Về nghi lễ thì ta biết rất ít.

**Đầy đủ:**

- **Sự thật.**
  - Bede (khoảng 725) viết rằng người Anh xưa gọi cả tháng 1 lẫn tháng 12 là Giuli, và tên ấy bắt nguồn từ việc mặt trời đổi chiều, vì một tháng đứng trước và một tháng đứng sau. https://www.monumenta.ch/latein/text.php?rumpfid=Beda+Venerabilis%2C+De+Temporum+Ratione%2C+++15&tabelle=Beda_Venerabilis
  - Bede kể người Anh xưa tính năm mới từ đêm 24 rạng 25/12 và gọi đêm ấy là “đêm của các bà mẹ”; ông chỉ phỏng đoán lý do là những nghi lễ thức đêm. https://www.monumenta.ch/latein/text.php?rumpfid=Beda+Venerabilis%2C+De+Temporum+Ratione%2C+++15&tabelle=Beda_Venerabilis
  - Từ Anh cổ geola có họ hàng với jól của Bắc Âu cổ nhưng dường như không phải con cháu của nó. https://www.wordorigins.org/big-list-entries/yule
  - Ghi chép về jól trong văn chương Bắc Âu cổ rất thưa, và lễ có thể khác nhau theo vùng. https://www.scandinavianarchaeology.com/from-jol-to-yule/
- **Truyền thuyết (“người ta kể rằng”).** Người ta kể rằng, theo Snorri Sturluson (viết khoảng năm 1230), Yule từng kéo dài ba ngày trước thời vua Hákon của Na Uy. Snorri viết gần ba thế kỷ sau vua ấy. Nguồn học thuật lưu ý còn độ ngờ về độ chính xác của Snorri khi nói về thời ngoại giáo. https://www.gutenberg.org/cache/epub/598/pg598.txt ; https://www.scandinavianarchaeology.com/from-jol-to-yule/
- **Theo Kinh Thánh / theo truyền thống.** Không có ở chương này.
- **Không dùng:** khúc củi Yule, “bánh xe mặt trời”, mọi chi tiết nghi lễ cổ; bản ghi Gothic.

## 7. `mistletoe` (nhãn DG †, mốc 1784)

**Nhãn và mốc: giữ.** Smithsonian ✔: “The first known reference to smooching under the plant dates to a 1784 English poem”. English Heritage ✔: “thought to have been first recorded in the comic-opera Two to One, written in 1784”. Hai nguồn gọi thể loại khác nhau (thơ, hài kịch có nhạc), nên Sổ tay nói “một tác phẩm năm 1784”. mistletoe.org.uk ✔: “it really only dates from the 18th century at the earliest”. DG đúng; † đúng vì người ta tưởng tục này cổ.

| # | Điểm | Trạng thái | Nguồn ✔ và cụm trích |
|---|---|---|---|
| M1 | Ghi chép đầu tiên được biết về hôn dưới tầm gửi: 1784, Anh | vững (“được biết”, không phải “có từ”) | Smithsonian https://www.smithsonianmag.com/history/how-mistletoe-became-christmas-kissing-tradition-180985450/ ; English Heritage https://www.english-heritage.org.uk/learn/histories/christmas-greenery-history : “When at Christmas in the hall ... And kiss beneath the mistletoe.” ; https://mistletoe.org.uk/mp/traditions/ |
| M2 | Herrick (1591–1674) là nguồn đầu tiên được biết gắn tầm gửi với Giáng Sinh | vững, chưa loại trừ nguồn sớm hơn | English Heritage: “The poet Robert Herrick (1591–1674) is the first known source to associate mistletoe with Christmas”; “What we don't know is whether the association between Christmas and mistletoe was a 17th-century invention, or if earlier references were just not recorded.” |
| M3 | “Kissing bough” có thể là gốc | tranh cãi (giả thuyết) | English Heritage: “This may be where the tradition of kissing under the mistletoe comes from.” Không dùng như sự thật |
| M4 | Truyện Baldur trong Prose Edda | truyền thuyết | Britannica https://www.britannica.com/topic/Edda : “The Prose Edda, or Younger Edda, was written by Snorri Sturluson around 1222–23.” Bản dịch https://en.wikisource.org/wiki/The_Elder_Edda_and_the_Younger_Edda/Younger_Edda/The_Death_of_Baldur : “'All things,' replied Frigga, 'except one little shrub that grows on the eastern side of Valhalla, and is called Mistletoe'”; “Hodur then took the mistletoe, and under the guidance of Loki, darted it at Baldur” |
| M5 | Baldur trong Poetic Edda (Völuspá 32–33) | truyền thuyết | https://sacred-texts.com/neu/poe/poe03.htm (bản dịch Bellows): “I saw for Baldr, the bleeding god, The son of Othin, his destiny set: Famous and fair in the lofty fields, Full grown in strength the mistletoe stood.”; “From the branch which seemed so slender and fair Came a harmful shaft that Hoth should hurl”. Chú thích của người dịch: “The story is fully told by Snorri”. Codex Regius (https://www.arnastofnun.is/en/news/new-electronic-edition-codex-regius-poetic-edda ✔): “dating from around 1270”. Vậy Baldur có ở cả hai Edda, đều là thế kỷ 13 |
| M6 | Pliny: druid hái tầm gửi | vững là nội dung bản ghi, không liên quan Giáng Sinh | https://www.perseus.tufts.edu/hopper/text?doc=Perseus%3Atext%3A1999.02.0137%3Abook%3D16%3Achapter%3D95 : “admiration that is lavished upon this plant by the Gauls”; “fifth day of the moon”; “cuts the mistletoe with a golden sickle”; cây là “the robur”. English Heritage: “Pliny made no mention either of Britain or the season” |
| M7 | Baldur hay Pliny dẫn đến tục hôn | thiếu nguồn | không nguồn nào đã mở nối. Smithsonian kể Baldur và druid như bối cảnh, không nói chúng sinh ra tục hôn |

**Mini game `custom`:** đúng; sửa nhẹ “earliest record 1784” thành “earliest known reference 1784” để khớp “first known”.

### Sổ tay `mistletoe`

**Thẻ:**

> Tục hôn dưới tầm gửi chỉ thấy ghi từ năm 1784 ở Anh.
> Truyện Baldur bị giết bằng cành tầm gửi có trong sách thế kỷ 13.
> Chưa ai chứng minh hai việc có liên quan.

**Đầy đủ:**

- **Sự thật.**
  - Ghi chép đầu tiên được biết về hôn dưới tầm gửi là một tác phẩm Anh năm 1784. https://www.smithsonianmag.com/history/how-mistletoe-became-christmas-kissing-tradition-180985450/ ; https://www.english-heritage.org.uk/learn/histories/christmas-greenery-history
  - Nguồn đầu tiên được biết gắn tầm gửi với Giáng Sinh là thơ của Robert Herrick (1591–1674); chưa rõ có nguồn sớm hơn mà không được ghi lại. https://www.english-heritage.org.uk/learn/histories/christmas-greenery-history
  - Pliny (thế kỷ 1) kể druid ở xứ Gaul hái tầm gửi trên cây sồi bằng liềm vàng; ông không nhắc Anh hay mùa Giáng Sinh. https://www.perseus.tufts.edu/hopper/text?doc=Perseus%3Atext%3A1999.02.0137%3Abook%3D16%3Achapter%3D95 ; https://www.english-heritage.org.uk/learn/histories/christmas-greenery-history
- **Truyền thuyết (“người ta kể rằng”).** Người ta kể rằng thần Baldur của Bắc Âu bị giết bằng một cành tầm gửi do thần Hödr ném theo sự chỉ dẫn của Loki. Truyện có trong Völuspá (Codex Regius, khoảng 1270) và được Snorri Sturluson kể đầy đủ trong Prose Edda (khoảng 1222–23). https://sacred-texts.com/neu/poe/poe03.htm ; https://en.wikisource.org/wiki/The_Elder_Edda_and_the_Younger_Edda/Younger_Edda/The_Death_of_Baldur ; https://www.britannica.com/topic/Edda ; https://www.arnastofnun.is/en/news/new-electronic-edition-codex-regius-poetic-edda
- **Theo Kinh Thánh / theo truyền thống.** Không có ở chương này.
- **Tranh cãi.** Có người cho tục hôn có thể bắt nguồn từ “kissing bough” (vòng cành treo); đây chỉ là giả thuyết. https://www.english-heritage.org.uk/learn/histories/christmas-greenery-history
- **Không dùng:** “tầm gửi trong Saturnalia”; “Baldur hoặc druid sinh ra tục hôn”.

## 8. `bethlehem` (nhãn KT, mốc “thế kỷ 1”)

**Nhãn: giữ (KT, theo Kinh Thánh). Mốc: đúng cho thời viết Tin Mừng, không cho thời sự kiện.** Bible Odyssey ✔ (https://www.bibleodyssey.org/articles/the-nativity/; curl bị 403, đọc qua bản chuyển văn bản r.jina.ai ngày 2026-11-19): “it only appears in two Gospels, Matthew and Luke. And their stories are quite different.”; “Most scholars date these texts to 80-100 C.E.” Ô Mốc nên ghi “cuối thế kỷ 1 (thời viết Tin Mừng)”. Hai cụm M0b ghi từ trang này (“Both accounts are from the late first century”, “Neither Matthew nor Luke gives a specific date for Jesus' birth”) không có trên trang hiện tại; chỉ dùng chữ đang có trên trang.

| # | Điểm | Trạng thái | Nguồn ✔ và cụm trích |
|---|---|---|---|
| B1 | Chỉ Mátthêu và Luca kể; hai bản khác nhau; đa số học giả xếp vào 80–100 SCN | vững | Bible Odyssey (cụm trên); “Only Matthew has a star, wise men, King Herod, and the slaughter of the toddlers in Bethlehem. Only Luke, in the passage under discussion, has a census, a stable, angels, and shepherds.” |
| B2 | Luca: Hài Nhi đặt nằm trong máng cỏ vì không có chỗ trong nhà trọ | theo Kinh Thánh | https://sotayconggiao.com/kinhthanh/chuong-02-tin-mung-theo-thanh-lu-ca/ (NPD): 2:7 “Bà sinh con trai đầu lòng, lấy tã bọc con, rồi đặt nằm trong máng cỏ, vì hai ông bà không tìm được chỗ trong nhà trọ.”; 2:4 “lên thành vua Đa-vít tức là Bê-lem, miền Giu-đê”; 2:12 “một trẻ sơ sinh bọc tã, nằm trong máng cỏ”. Tìm chữ trong cả chương 2 (2026-11-19): “máng cỏ” 3 lần (2:7, 2:12, 2:16), “nhà trọ” 1 lần (2:7), “chăn chiên” ở 2:8; không có “chuồng”, “bò”, “lừa”, “chiêm tinh”, “ngôi sao”. Cùng câu 2:7 The Conversation viết “there was no guest room available for them”: “nhà trọ” của game theo NPD, “guest room” là chữ của bài tiếng Anh |
| B3 | Mátthêu: các nhà chiêm tinh từ phương Đông thấy ngôi sao, vào nhà, dâng vàng, nhũ hương, mộc dược | theo Kinh Thánh | https://hdgmvietnam.com/chi-tiet/ngoi-sao-dan-duong-6-1-2013-chua-nhat-chua-hien-linh--34628 (Mt 2,1–12, dạng viết liền): “có mấy nhà chiêm tinh từ phương Ðông đến Giêrusalem”; “Chúng tôi đã thấy vì sao của Người xuất hiện bên phương Ðông”; “Họ vào nhà, thấy Hài Nhi với thân mẫu là bà Maria”; “mở bảo tráp, lấy vàng, nhũ hương và mộc dược mà dâng tiến”. Bài https://hdgmvietnam.com/chi-tiet/le-chua-hien-linh-ba-vua-cac-dao-si-hay-cac-nha-chiem-tinh--54255 in cùng đoạn dạng NPD (“Họ vào nhà”, “vàng, nhũ hương và một dược”); trong đoạn Mt 2,1–12 (cả hai bài) không có “chuồng”, “bò”, “lừa” và không có số người. Phạm vi tìm chữ thật: NPD Mátthêu 2 (https://sotayconggiao.com/kinhthanh/chuong-02-tin-mung-theo-thanh-mat-theu/), cả chương 2 (2026-11-19): không có “chuồng”, “bò”; “lừa” chỉ có ở 2:16, trong “các nhà chiêm tinh đánh lừa” (động từ, không phải con vật); không nêu con vật nào Mátthêu kể tên ba lễ vật nhưng không viết con số ba |
| B4 | Bò và lừa không có trong văn bản | vững | https://theconversation.com/five-christmas-story-elements-that-dont-appear-in-the-bible-from-the-little-donkey-to-the-inn-keeper-246051 : “there are no animals at all in the Bible's nativity episode”. Câu của bài rộng hơn văn bản: Lc 2:8 (NPD) có “canh giữ đàn vật” của các mục đồng, và Lc 2:24 có “một đôi chim gáy hay một cặp bồ câu non” dâng trong Đền Thờ; game không dùng vế “không có con vật nào”, chỉ nói Luca 2 và Mátthêu 2 không nhắc con bò, con lừa nào (khớp tìm chữ ở B2 và B3) |
| B4b | Chuồng: hai nguồn hiện đại bất đồng | tranh cãi | The Conversation (cùng bài): “Neither does the Bible mention a stable. A stable is assumed to be Jesus' birth place because of the lack of guest rooms and because Jesus was laid in a manger, a feeding trough for animals.” Bible Odyssey (B1): “Only Luke, in the passage under discussion, has … a stable”. Trọng tài là văn bản: NPD Luca 2 không có chữ “chuồng” (B2). Game chỉ khẳng định “chữ ấy không có trong Luca 2 và Mátthêu 2”, không khẳng định chuồng không từng có; Sổ tay nêu cả hai nguồn |
| B5 | Mátthêu không nêu số nhà chiêm tinh, không gọi họ là vua; họ vào “nhà”; Luca không kể họ | vững | The Conversation (cùng bài): “the Bible doesn't give the number of magi who presented them”; “entered a 'house' (not a stable then)”. HĐGMVN (https://hdgmvietnam.com/chi-tiet/le-chua-hien-linh-ba-vua-cac-dao-si-hay-cac-nha-chiem-tinh--54255 ): “Họ không phải là vua như chúng ta vẫn thường gọi Ba Vua”; “Trong bốn quyển Tin Mừng, chỉ có tác giả Mát-thêu kể lại câu truyện các nhà chiêm tinh”. Wikipedia ✔ (https://en.wikipedia.org/wiki/Biblical_Magi): “Their names, origins, appearances, and exact number are unmentioned and derive from the inferences or traditions of later Christians.” Cảnh báo: chính trang HĐGMVN này, trong phần giải thích, viết Hài Nhi “nằm trong máng cỏ” khi nói về các nhà chiêm tinh; câu Mt 2:11 trong cùng trang chỉ có “vào nhà”. Game theo câu Kinh Thánh |
| B6 | “Vua” từ đầu thế kỷ 3; con số ba có lẽ từ ba lễ vật; tên Melchior, Gaspard, Balthazar khoảng thế kỷ 8 | vững; việc gán con số ba cho Origênê chỉ có một nguồn | HĐGMVN (cùng trang): “Gốc gác hoàng tộc của các nhà chiêm tinh xuất hiện vào đầu thế kỷ thứ 3, từ ông Tertullianô”; “chính Origênê là người đầu tiên đặt con số của các nhà chiêm tinh là ba, có lẽ dựa trên ba món quà”; “vào khoảng thế kỷ thứ 8, ... Melchior, Gaspard và Balthazar”. Nguồn thứ hai về con số ba, Catholic Encyclopedia ✔ (https://www.newadvent.org/cathen/09527a.htm): “The Gospel narrative omits to mention the number of the Magi, and there is no certain tradition in this matter. Some Fathers speak of three Magi; they are very likely influenced by the number of gifts.”; về “vua”: “No Father of the Church holds the Magi to have been kings. Tertullian ("Adv. Marcion.", III, xiii) says that they were wellnigh kings (fere reges)”. Wikipedia ✔ (B5): “It was these three gifts, it is thought, which were the chief cause for the number of the Magi becoming fixed eventually at three.” Cả hai nguồn thứ hai không nêu tên Origênê cho con số ba, và bài giảng Sáng thế của Origênê không mở được: tên Origênê chỉ có HĐGMVN, giữ “có lẽ”. Ba tên: Yale và BAR nêu mốc sớm hơn HĐGMVN (xem B22) |
| B7 | Thời điểm thêm bò, lừa (và chuồng) vào tranh | hình bò, lừa bên máng cỏ: thế kỷ 4 (vững); chuồng: thiếu nguồn | Hình Chúa Hài Đồng trong máng cỏ bên bò và lừa hiện ra ở thế kỷ 4: xem B12 (Yale ISM, Vatican News, Wikipedia). Chỉ nói “hình”, không nói chuồng, bò, lừa “được thêm về sau”. Thời điểm chuồng vào tranh: không nguồn nào mở được nêu |
| B8 | Nơi sinh là Bêlem | tranh cãi | BAR https://www.biblicalarchaeology.org/daily/people-cultures-in-the-bible/jesus-historical-jesus/where-was-jesus-born/ : “why is Bethlehem not mentioned as Jesus' birthplace outside of the infancy narratives in the Gospels? This has caused some to wonder if Jesus was actually born in Nazareth.” Bible Odyssey: “Despite their differences, Matthew and Luke both agree that Jesus was born in Bethlehem.”; “no other New Testament text mentions it: there is nothing in the letters of Paul, our earliest Christian writer, and nothing in Mark, our earliest Gospel” (“it” là truyền thống Bêlem là nơi sinh); “it seems more likely that the story was developed within early Christian circles to connect Jesus with the Davidic Messiah”. Gioan 7:42 (https://sotayconggiao.com/kinhthanh/chuong-07-tin-mung-theo-thanh-gio-an/, NPD) có nhắc Bêlem, chỉ như làng của vua Đavít, không như nơi sinh của Chúa Giêsu: “Đấng Ki-tô xuất thân từ dòng dõi vua Đa-vít và từ Bê-lem, làng của vua Đa-vít sao?”. Phía còn lại: Luca và Mátthêu đều đặt sự kiện ở Bêlem (B2, B3) |
| B9 | Điều tra dân số và năm Hêrôđê mất | tranh cãi | Bible Odyssey: “Was there really a census? Yes—it was carried out by Publius Sulpicius Quirinius, the capable legate of Syria (6-12 C.E.). When Herod I died in 4 B.C.E.”; https://doi.org/10.1163/9789004370906_004 (Brill, Croy; tóm tắt) liệt kê các khó khăn của tường thuật điều tra của Luca. Sinh khoảng 6–4 TCN (https://www.britannica.com/biography/Jesus ✔) |
| B10 | Ngày sinh | không có | Bible Odyssey: “In all probability, the earliest Christians did not know exactly when Jesus was born.” The Conversation: “the Bible offers scant information on when Mary gave birth”. Văn bản NPD Luca 2 và HĐGMVN Mátthêu 2 không ghi ngày. Ngày 25/12 (phương Tây) và 6/1 (phương Đông) từ thế kỷ 4: xem §9 |
| B11 | Văn bản sớm nhất nối máng cỏ với bò và lừa là Origênê, bài giảng Luca 13, khoảng 233–234 (bản Latinh của Giêrônimô khoảng 390) | vững về niên đại bài giảng; vế trích lời Origênê chưa có nguồn thứ hai | Niên đại: Sources Chrétiennes https://sourceschretiennes.org/collection/SC-87 ✔: “Ces homélies ont dû être prêchées au début du second séjour à Césarée, vers 233-234.” CUA Press https://www.cuapress.org/9780813217444/homilies-on-luke/ ✔: “Origen preached them in Caesarea, perhaps around 234 or 240”. Lời Origênê: https://historicalchristian.faith/by_father.php?file=Origen%2520of%2520Alexandria%2FHomilies%2520on%2520Luke%2FHomily13.html ✔ (trang tổng hợp, không thuộc loại nguồn đã duyệt): “That was the manger of which the prophet prophesied, saying: 'the ox knew its owner, and the ass the manger of its lord'.” Hai nguồn học thuật khớp về niên đại; câu của Origênê chỉ có một trang, chưa dùng trên màn hình |
| B12 | Hình đầu tiên có bò và lừa là thế kỷ 4 (thạch quan, phù điêu) | vững | Wikipedia ✔ https://en.wikipedia.org/wiki/Nativity_of_Jesus_in_art: “The earliest pictorial representations of Jesus' Nativity come from sarcophagi in Rome and Southern Gaul”; “The ox and ass are always present, even when Mary or any other human is not.” Yale ISM Review ✔ https://www.ismreview.yale.edu/the-magi-and-the-manger-imaging-christmas-in-ancient-art-and-ritual: “This shift in focus onto the Christ child had begun in the fourth century when the Lukan crib or manger was represented for the first time. The child was shown lying alone in the manger, without parents or human visitors, accompanied only by the ox and ass.” Vatican News ✔ https://www.vaticannews.va/en/vatican-city/news/2023-12/christmas-tours-vatican-museums-sr-edwards-nativity-scenes-art.html: “One of the earliest nativity scenes ever, dating back to a sarcophagus from the 4th century and preserved at the Vatican Museums”. Ba nguồn độc lập khớp “thế kỷ 4”. Trang christianiconography.info (cá nhân, không dùng) chú thích một thạch quan là “3rd century”, lệch với ba nguồn trên |
| B13 | Truyện bò và lừa thờ lạy Chúa Hài Đồng (Tin Mừng Giả Mátthêu) là muộn: khoảng thế kỷ 7, nhiều nhất 8–9; bản chép tay cũ nhất thế kỷ 9 | tranh cãi về năm, vững về “không sớm” | Wikipedia ✔ https://en.wikipedia.org/wiki/Gospel_of_Pseudo-Matthew: “The Gospel adds the first known mention of an ox and a donkey being present at the nativity of Jesus”; “the original composition date might be in the first half of the seventh century”; “composed in the 8th or 9th century”; “Surviving manuscripts … date from the 9th century to the 16th century.” The Conversation ✔ https://theconversation.com/an-ox-an-ass-a-dragon-sorry-there-were-no-animals-in-the-bibles-nativity-scene-89202: “A later Latin text from the seventh to eighth century AD, called the Gospel of Pseudo-Matthew”. Hai nguồn khớp khoảng 7–8. Câu “first known mention” của Wikipedia mâu thuẫn với B11 (Origênê và hình thế kỷ 4 đều sớm hơn): chỉ dùng Giả Mátthêu như nguồn truyện, không như nguồn “sớm nhất” |
| B14 | Origênê sinh khoảng 185, mất khoảng 253–254 | vững | Wikipedia ✔ https://en.wikipedia.org/wiki/Origen: “Origen of Alexandria (c. 185 – c. 253)”. Britannica Kids ✔ https://kids.britannica.com/scholars/article/Origen/57374: “born c. 185, probably Alexandria, Egypt—died c. 254, Tyre”. IEP ✔ https://iep.utm.edu/origen-of-alexandria/ chỉ trích qua kết quả tìm, chưa mở trọn trang. Hai nguồn đã mở khớp; năm mất lệch 253/254 nên viết “khoảng 254” |
| B15 | Origênê nhắc “ba” nhà chiêm tinh một cách thăm dò, trong bài giảng Sáng thế 14; bài viết khoảng 245–250, bản Latinh của Rufinô khoảng 400 | tranh cãi | BMCR (Đại học Bryn Mawr) ✔ https://bmcr.brynmawr.edu/2012/2012.04.46/: “Origen held these homilies in his later years in Caesarea Maritima, most probably in the period between 245 and 250”; “Rufinus' translations (made about 400 CE) are often unreliable”. Câu của Origênê chỉ qua trang https://historicalchristian.faith/doctrine/doctrines/magi/origen.html (kết quả tìm, chưa mở trọn trang): “can bear the figure of the Magi”, tức “ba” lấy từ ba vị khách của Isaac, không phải lời khẳng định số nhà chiêm tinh. HĐGMVN (B6) nói “chính Origênê là người đầu tiên đặt con số … là ba”. Catholic Encyclopedia ✔ (B6) chỉ nói “Some Fathers speak of three Magi”, không nêu tên. Không có nguồn thứ hai nêu tên Origênê. Giữ “có lẽ”. BAR ✔ (B17, B22): “By the second century, they were identified as three”; Yale ✔ (B17): hình Priscilla “late third or early fourth century” cho thấy “three in number”; BAR ✔ (B17): hình ấy “shown as three men”. Ba nguồn ba mốc cho con số ba: BAR thế kỷ 2, HĐGMVN và Origênê thế kỷ 3 (thăm dò), Yale cuối 3 hoặc đầu 4; không thế kỷ nào cả ba nguồn cùng nêu. Game chỉ nêu ba mốc và để mảnh “số ba” ngoài bàn bằng một thẻ nêu cả ba |
| B16 | Origênê (Chống Celsô I,60) đọc ba lễ vật: vàng cho vua, mộc dược cho người phải chết, nhũ hương cho Thiên Chúa | vững | Wikipedia ✔ https://en.wikipedia.org/wiki/Biblical_Magi: “This dates back to Origen in Contra Celsum: 'gold, as to a king; myrrh, as to one who was mortal; and incense, as to a God.'” Đây là nguồn gốc ý “ba lễ vật”, không phải số người |
| B17 | Hình nhà chiêm tinh cổ nhất còn lại: hầm mộ Priscilla (Rôma), giữa hoặc cuối thế kỷ 3. Hai nguồn lệch niên đại | tranh cãi (mốc), vững (là hình sớm nhất) | BAR ✔ https://www.biblicalarchaeology.org/daily/biblical-topics/new-testament/witnessing-the-divine/ (R. Jensen): “The earliest extant portrayal … of the magi, dated to the mid-third century, appears above an arch in the Catacomb of Priscilla, in Rome.”; “predates most other New Testament scenes as well as any other representation of Jesus' nativity”. Yale ISM ✔ (cùng URL B12): “Dating from the late third or early fourth century, the painting attests that the Magi were now understood to be three in number”. Wikipedia ✔ (Biblical Magi): “Incised third century A.D. sarcophagus slab depicts the Adoration of the Magi, from the Catacombs of Rome”. Viết “thế kỷ 3”. Hình có ba người, nhưng Yale/BAR cho thấy “ba” ở hình khác với “ba” trong chữ. Thế kỷ 3 là phần chung của hai mốc (BAR giữa thế kỷ 3; Yale cuối thế kỷ 3 hoặc đầu thế kỷ 4); thẻ chỉ nói “cùng thế kỷ với ý vua” theo BAR và ghi mốc của Yale ở thẻ số ba |
| B18 | Cảnh nhà chiêm tinh xuất hiện trong nghệ thuật trước mọi cảnh máng cỏ | vững | BAR ✔ (cùng B17): “In art, the adoration of the magi appeared earlier and far more frequently than any other scene of Jesus' birth and infancy, including images of the babe in a manger.” Yale ✔: “They were shown bearing their gifts and moving in rhythmic procession towards Mary” (giữa thế kỷ 3). Hai nguồn khớp. BAR ✔: “By the third century, biblical interpreters were finding echoes of Psalm 72 in the narrative of the three gift-bearing visitors”; “The magi were identified as these kings of “all nations””. Yale ✔: “by the third century, Tertullian ( Against Marcion 3.13) writes “The East considers the Magi almost as Kings.”” (ý “vua” có ở thế kỷ 3, trước hình máng cỏ thế kỷ 4) |
| B19 | Hang là nơi sinh: Tiền Phúc Âm Giacôbê (thế kỷ 2, khoảng 150 trở đi) và Justinô (mất 165) | vững về niên đại; hang/chuồng là chỗ hai nguồn hiện đại bất đồng (không chọn phe) | Giacôbê: newadvent ✔ https://www.newadvent.org/fathers/0847.htm: “And he found a cave there, and led her into it”; Wikipedia ✔ https://en.wikipedia.org/wiki/Gospel_of_James: “a second-century infancy gospel”; “assumed to be in circulation soon after circa 150 AD”; “the earliest manuscript … (Papyrus Bodmer 5) dates to the third or fourth century”. Justinô, Đối thoại với Trypho 78 ✔ https://www.bibliatheo.com/texts/dialogue-with-trypho/dialogue-with-trypho/78: “since Joseph could not find a lodging in that village, he took up his quarters in a certain cave near the village; and while they were there Mary brought forth the Christ and placed Him in a manger”. Catholic Encyclopedia “Crib” ✔ https://www.newadvent.org/cathen/04488c.htm: “St. Justin, who died a martyr in 165, says…” (trang này ghi “Dialogue with Trypho 70”, sai số chương: là 78). Bible Odyssey ✔ (B1): “Only Luke … has … a stable”. The Conversation 2024 (B4b): “Neither does the Bible mention a stable”. The Conversation 2017 ✔ (URL B13): “James sets the birth in a cave the couple pass on their way rather than a domestic space”. Bible Odyssey và Conversation vẫn bất đồng về chuồng; chỉ cần nói “hang” từ thế kỷ 2 |
| B20 | Origênê (Chống Celsô I,51) nói người ta chỉ cho xem hang ở Bêlem, khoảng nửa thế kỷ sau Justinô | vững một nguồn | Catholic Encyclopedia ✔ (cùng B19): “'…at Bethlehem is shown the grotto where he first saw the light' (Against Celsus I.51)”. Một nguồn đã mở; chưa có nguồn thứ hai |
| B21 | Lễ 6/1: nguồn đã mở ghi lễ Hiển Linh lần đầu năm 361 (Ammianus Marcellinus); nguồn chắc chắn sớm nhất trước đó nói về nhóm Basilidê (Clêmentê Alêxanđria) mừng ngày Rửa tội; Wikipedia thêm mốc khoảng năm 200, chỉ để lần nguồn | vững cho 361; mốc “Hiển Linh gắn với nhà chiêm tinh” thiếu nguồn | Wikipedia ✔ https://en.wikipedia.org/wiki/Epiphany_(holiday): “The earliest reference to Epiphany as a Christian feast was in AD 361, by Ammianus Marcellinus.”; Basilidê “celebrate the day of His Baptism”. Catholic Encyclopedia ✔ https://newadvent.org/cathen/05504c.htm: “the first actual reference to the ecclesiastical feast of the Epiphany (Ammianus Marcellinus, XXI, ii), in 361”; “The first reference about which we can feel certain is in Clement (Stromata I.21.45)”: “the followers of Basilides celebrate the day of His Baptism too, spending the previous night in readings”; “Origen, in his list of festivals (Against Celsus VIII.22), makes no mention of Epiphany”. Yale ✔: “the later Eastern date became associated with the visit of the Magi, as Epiphany”. Hai nguồn khớp về 361. Chưa có câu nào ghi “6/1 gắn với nhà chiêm tinh từ năm X” |
| B22 | Ba tên Melchior, Gaspard, Balthazar: các nguồn lệch thế kỷ | tranh cãi (mốc) | HĐGMVN (B6): “vào khoảng thế kỷ thứ 8”. Yale ✔ (URL B12): “By the sixth century the Magi had been given the names Balthasar, Melchior, and Gaspar.”, kèm khảm thế kỷ 6 ở Sant’Apollinare Nuovo, Ravenna. BAR ✔ (URL B17): “By the second century, they were identified as three; by the fifth, they were identified as kings and, in the West, given the names Balthassar, Melchior and Gaspar, which appear above the magi (perhaps as a late addition) in this mosaic.” Ba mốc: thế kỷ 5 (BAR, có thể là phần thêm muộn), 6 (Yale), 8 (HĐGMVN). Game không đặt tên vào một thế kỷ và không viết “chỉ gặp từ khoảng thế kỷ 8” |

**Cảnh báo:** bài giảng Đêm Giáng Sinh trên HĐGMVN (https://hdgmvietnam.com/chi-tiet/bai-giang-duc-thanh-cha-le-dem-giang-sinh-53147 ✔) dùng “mái chuồng súc vật ở Bêlem”. Sổ tay phải nói “văn bản Tin Mừng chỉ có máng cỏ”, không viết “Giáo hội sai”. **Mini game `custom` (máng cỏ của Luca, ngôi sao của Mátthêu, không vẽ nhân vật):** đúng.

### Sổ tay `bethlehem`

**Thẻ:**

> Theo Tin Mừng Luca, Chúa Hài Đồng được đặt nằm trong máng cỏ ở Bêlem vì không có chỗ trong nhà trọ.
> Chỉ Mátthêu và Luca kể chuyện này, mỗi người một cách.
> Luca 2 và Mátthêu 2 không nhắc con bò, con lừa nào, và không có chữ “chuồng”.

**Đầy đủ:**

- **Sự thật.**
  - Chỉ hai Tin Mừng, Mátthêu và Luca, kể về sự ra đời; hai bản khác nhau khá nhiều, và đa số học giả xếp chúng vào khoảng năm 80–100 SCN. https://www.bibleodyssey.org/articles/the-nativity/
  - Luca 2 và Mátthêu 2 không nhắc con bò, con lừa nào, và không có chữ “chuồng”; The Conversation cũng nói bò và lừa không có trong tường thuật. https://theconversation.com/five-christmas-story-elements-that-dont-appear-in-the-bible-from-the-little-donkey-to-the-inn-keeper-246051 ; https://sotayconggiao.com/kinhthanh/chuong-02-tin-mung-theo-thanh-lu-ca/ ; https://sotayconggiao.com/kinhthanh/chuong-02-tin-mung-theo-thanh-mat-theu/
  - Mátthêu không nêu số các nhà chiêm tinh, không gọi họ là vua và kể họ vào một ngôi nhà; chỉ Mátthêu kể chuyện này, Luca không kể. https://theconversation.com/five-christmas-story-elements-that-dont-appear-in-the-bible-from-the-little-donkey-to-the-inn-keeper-246051 ; https://hdgmvietnam.com/chi-tiet/le-chua-hien-linh-ba-vua-cac-dao-si-hay-cac-nha-chiem-tinh--54255
  - Ý “vua” xuất hiện từ ông Tertullianô đầu thế kỷ 3; con số ba có lẽ do ba lễ vật. https://hdgmvietnam.com/chi-tiet/le-chua-hien-linh-ba-vua-cac-dao-si-hay-cac-nha-chiem-tinh--54255 ; https://www.newadvent.org/cathen/09527a.htm
  - Chuyện nơi sinh là một cái hang được ghi từ thế kỷ 2: Tiền Phúc Âm Giacôbê, khoảng năm 150 trở đi, và Justinô, mất năm 165. https://www.newadvent.org/fathers/0847.htm ; https://www.bibliatheo.com/texts/dialogue-with-trypho/dialogue-with-trypho/78
  - Hình các nhà chiêm tinh ở hầm mộ Priscilla là hình cổ nhất còn lại: BAR xếp giữa thế kỷ 3, Yale xếp cuối thế kỷ 3 hoặc đầu thế kỷ 4; BAR nói hình này có trước mọi hình khác về sự ra đời của Chúa Giêsu. https://www.biblicalarchaeology.org/daily/biblical-topics/new-testament/witnessing-the-divine/ ; https://www.ismreview.yale.edu/the-magi-and-the-manger-imaging-christmas-in-ancient-art-and-ritual
  - Hình Chúa Hài Đồng trong máng cỏ, bên bò và lừa, hiện ra ở thế kỷ 4. https://www.ismreview.yale.edu/the-magi-and-the-manger-imaging-christmas-in-ancient-art-and-ritual ; https://www.vaticannews.va/en/vatican-city/news/2023-12/christmas-tours-vatican-museums-sr-edwards-nativity-scenes-art.html
Lễ Hiển Linh của Giáo hội được nhắc đến sớm nhất vào năm 361; trước đó, nguồn chắc chắn sớm nhất nói về nhóm Basilidê mừng ngày Rửa tội. https://newadvent.org/cathen/05504c.htm
- **Theo Kinh Thánh.**
  - Luca 2: ông bà đi từ Nadarét lên Bêlem; Đức Maria sinh con đầu lòng, bọc tã, đặt vào máng cỏ vì không có chỗ ở nhà trọ. https://sotayconggiao.com/kinhthanh/chuong-02-tin-mung-theo-thanh-lu-ca/
  - Mátthêu 2: các nhà chiêm tinh từ phương Đông thấy ngôi sao, đến Giêrusalem hỏi Đức Vua dân Do Thái mới sinh; họ vào nhà gặp Chúa Hài Đồng và dâng vàng, nhũ hương, mộc dược. https://hdgmvietnam.com/chi-tiet/ngoi-sao-dan-duong-6-1-2013-chua-nhat-chua-hien-linh--34628
- **Tranh cãi (cả hai phía).**
  - Chuồng: Bible Odyssey viết chỉ Luca có chuồng; The Conversation viết Kinh Thánh không nhắc chuồng, chỉ suy ra từ máng cỏ và hết chỗ trọ. Văn bản Luca 2 (bản NPD) có máng cỏ và nhà trọ, không có chữ chuồng. https://www.bibleodyssey.org/articles/the-nativity/ ; https://theconversation.com/five-christmas-story-elements-that-dont-appear-in-the-bible-from-the-little-donkey-to-the-inn-keeper-246051 ; https://sotayconggiao.com/kinhthanh/chuong-02-tin-mung-theo-thanh-lu-ca/
  - Con số ba: BAR nói ba từ thế kỷ 2; HĐGMVN nói Origênê, thế kỷ 3, có lẽ dựa trên ba lễ vật; Yale xếp hình Priscilla, cuối thế kỷ 3 hoặc đầu thế kỷ 4, cho thấy ba người; Catholic Encyclopedia chỉ nói một số giáo phụ nói ba người; không thế kỷ nào cả ba nguồn cùng nêu. https://www.biblicalarchaeology.org/daily/biblical-topics/new-testament/witnessing-the-divine/ ; https://hdgmvietnam.com/chi-tiet/le-chua-hien-linh-ba-vua-cac-dao-si-hay-cac-nha-chiem-tinh--54255 ; https://www.ismreview.yale.edu/the-magi-and-the-manger-imaging-christmas-in-ancient-art-and-ritual ; https://www.newadvent.org/cathen/09527a.htm
  - Ba tên Melchior, Gaspard, Balthazar: HĐGMVN nói khoảng thế kỷ 8, Yale nói thế kỷ 6, BAR nói thế kỷ 5 và ghi tên có thể là phần thêm muộn. https://hdgmvietnam.com/chi-tiet/le-chua-hien-linh-ba-vua-cac-dao-si-hay-cac-nha-chiem-tinh--54255 ; https://www.ismreview.yale.edu/the-magi-and-the-manger-imaging-christmas-in-ancient-art-and-ritual ; https://www.biblicalarchaeology.org/daily/biblical-topics/new-testament/witnessing-the-divine/
  - Nơi sinh, phía tin Bêlem: cả Mátthêu và Luca đều đặt sự kiện ở Bêlem. https://www.biblicalarchaeology.org/daily/people-cultures-in-the-bible/jesus-historical-jesus/where-was-jesus-born/ ; https://www.bibleodyssey.org/articles/the-nativity/
  - Nơi sinh, phía ngờ: không sách Tân Ước nào khác nêu Bêlem là nơi sinh (Gioan 7:42 nhắc Bêlem chỉ như làng của vua Đavít), nên có người ngờ ngài sinh ở Nadarét. https://www.biblicalarchaeology.org/daily/people-cultures-in-the-bible/jesus-historical-jesus/where-was-jesus-born/ ; https://www.bibleodyssey.org/articles/the-nativity/ ; https://sotayconggiao.com/kinhthanh/chuong-07-tin-mung-theo-thanh-gio-an/
  - Nơi sinh, phía ngờ: Bible Odyssey cho là nhiều khả năng chuyện Bêlem được dựng để nối Chúa Giêsu với dòng vua Đavít. https://www.bibleodyssey.org/articles/the-nativity/
  - Điều tra dân số: Luca nêu Quiriniô (6–12 SCN), còn Hêrôđê mất năm 4 TCN, nên các tường thuật khó khớp. https://www.bibleodyssey.org/articles/the-nativity/ ; https://doi.org/10.1163/9789004370906_004

## 9. `dec25` (nhãn KT, mốc 354)

**Nhãn: giữ. Mốc 354: giữ, thêm chú thích.** Liverpool ✔ (https://www.liverpool.ac.uk/history/blog/2023/first-noel/): “In 354 a Roman aristocrat named Valentinus commissioned a book of calendars.”; “'On the eight day before the kalends of January [25 December], Christ was born in Bethlehem in Judaea.'”; “This is the first known reference to a Christmas festival. It's generally thought that this calendar was first produced in 336”. History Today ✔ (https://www.historytoday.com/archive/months-past/first-christmas-celebration): “The first recorded celebration of 25 December doesn't arrive until 336 in an almanac”. Connell ✔ (https://digitalcommons.csbsju.edu/cgi/viewcontent.cgi?article=1058&context=theology_pubs): “the earliest extant evidence for Christmas on December 25, in 336 in Rome”. Vậy bản còn lại là bản đặt làm năm 354, năm gốc được cho là 336. Mốc 354 vẫn an toàn nếu có chú thích.

| # | Điểm | Trạng thái | Nguồn ✔ và cụm trích |
|---|---|---|---|
| D1 | Lịch 354 ghi “Christ was born in Bethlehem in Judaea” vào 25/12 | vững | Liverpool; History Today: “At the top of that list is the date 25 December: 'natus Christus in Betleem Judeae'” |
| D2 | Danh sách có từ 336 | tranh cãi nhẹ (“generally thought”) | Liverpool, History Today, Connell (cụm ở trên); thẻ dec25 c2 giữ là sự thật, viết “được cho là” và nêu Liverpool, History Today |
| D3 | Giả thuyết 1: chọn trùng lễ mặt trời | tranh cãi | History Today: “One theory is that the date was chosen because it was the pagan solstice festival of Sol Invictus.” |
| D4 | Giả thuyết 2: tính từ 25/3 (lễ Truyền Tin) | tranh cãi | History Today: “Another has it calculated from 25 March, the date of the Annunciation.” https://doi.org/10.1017/s0009640712001941 : “History of Religions Theory” và “Calculation Theory” |
| D5 | Lễ mặt trời 25/12 có trước lễ Kitô? | tranh cãi | https://penelope.uchicago.edu/encyclopaedia_romana/calendar/invictus.html : “VIII Kal. Jan. (December 25) is annotated N INVICTI CM XXX. Although the dedication is uncertain ... the presumption is that Natalis Invicti refers to the birthday of the Invincible Sun.” Hijmans (https://www.academia.edu/968841/_Sol_Invictus_the_Winter_Solstice_and_the_Origins_of_Christmas_Mouseion_Number_47_3_2003_377_398 ): “It is therefore unwarranted to take for granted that the actual festival celebrating the Natalis Invicti with 30 chariot races, mentioned in the Calendar of 354, was itself older than the Christian feast honoring Christ's birthday on that day.”; “This is purely conjectural, of course, but by no means unlikely.” Phía có: NatGeo “the Dies Natalis Solis Invicti ... established by the emperor Aurelian in 274 CE” (Penelope không nêu 274) |
| D6 | Giáo hoàng Libêriô “ấn định” 25/12 năm 354 | **sai/nói quá** | Nguồn nói quá: tonggiaophanhanoi.org và cgvdt.vn (cụm ở mục 2.13). Nguồn tốt hơn: Ambrose, De virginibus III.1 https://www.newadvent.org/fathers/34073.htm : “on the Nativity of the Saviour in the Church of St. Peter you signified your profession of virginity by your change of attire”, Libêriô trao khăn che cho Marcellina, không nêu năm hay ngày 25/12. Connell: “recalling an event that had taken place in Rome almost a quarter century earlier, in 353 (or perhaps 354)”; tiêu đề bài hỏi cả “December 25 or January 6?” |
| D7 | Không ai biết ngày sinh thật | vững | Hijmans: “It is well known that we do not know the exact date of the birth of Jesus Christ ... the date was not recorded.” |
| D8 | Ngày 25/12 được cử hành ở Constantinople năm 380 | vững | History Today: “By 380 the day was being celebrated in Constantinople” (không dùng trong Sổ tay trừ khi cần) |
| D9 | “Chín tháng” từ 25/3 | thiếu nguồn cho cụm “chín tháng” | nguồn chỉ nói “calculated from 25 March” |

**Mini game `custom` (hai giả thuyết cùng đáp xuống 25/12, sử gia chưa đồng ý):** đúng ở mức D3, D4, D5; xem 2.12 về “chín tháng”.

### Sổ tay `dec25`

**Thẻ:**

> Bản ghi sớm nhất được biết về lễ Giáng Sinh ngày 25/12 nằm trong một cuốn lịch ở Rôma giữa thế kỷ 4 (lịch 354).
> Vì sao chọn ngày ấy thì có hai giả thuyết: trùng lễ mặt trời, hoặc tính từ 25/3.
> Sử gia chưa thống nhất.

**Đầy đủ:**

- **Sự thật.**
  - Năm 354 một quý tộc La Mã đặt làm một cuốn lịch; mục ngày 25/12 ghi Chúa Kitô sinh ở Bêlem, miền Giuđê. Danh sách này được cho là có từ năm 336. https://www.liverpool.ac.uk/history/blog/2023/first-noel/ ; https://www.historytoday.com/archive/months-past/first-christmas-celebration
  - Không ai biết ngày sinh thật. https://www.academia.edu/968841/_Sol_Invictus_the_Winter_Solstice_and_the_Origins_of_Christmas_Mouseion_Number_47_3_2003_377_398
  - Cùng cuốn lịch 354 có mục lễ “N INVICTI” ngày 25/12, với ba mươi cuộc đua xe. https://penelope.uchicago.edu/encyclopaedia_romana/calendar/invictus.html
- **Truyền thuyết.** Không có ở chương này. Chuyện Giáo hoàng Libêriô “ấn định” 25/12 năm 354 không có trong nguồn học thuật; Sổ tay không chép.
- **Theo truyền thống.** Không có ở chương này.
- **Tranh cãi (cả hai phía).**
  - Giả thuyết “lịch sử tôn giáo”: ngày 25/12 được chọn vì trùng lễ mặt trời. Phía này dựa vào mục “N INVICTI”. https://www.historytoday.com/archive/months-past/first-christmas-celebration ; https://penelope.uchicago.edu/encyclopaedia_romana/calendar/invictus.html
  - Giả thuyết “tính toán”: ngày 25/12 được tính từ 25/3, ngày Truyền Tin. https://www.historytoday.com/archive/months-past/first-christmas-celebration
  - Nghi vấn về thứ tự: lịch 354 là nơi duy nhất có cả hai mục; sử gia Hijmans cho rằng không thể chắc lễ mặt trời có trước, và lễ ấy có thể được lập sau lễ Kitô. Một bài tổng quan năm 2012 khuyên giữ cả hai hướng nhưng nhìn tinh tế hơn. https://www.academia.edu/968841/_Sol_Invictus_the_Winter_Solstice_and_the_Origins_of_Christmas_Mouseion_Number_47_3_2003_377_398 ; https://doi.org/10.1017/s0009640712001941

## 10. `nicholas` (nhãn KT, mốc “khoảng 700”)

**Nhãn: giữ (KT). Mốc: giữ có điều kiện.** Bản ghi sớm nhất của truyện là tiểu sử của Michael the Archimandrite. Niên đại tranh cãi: c.700 (https://www.stnicholascenter.org/who-is-st-nicholas/real-person/early-sources ✔: “can be dated to c.700”); 710–720 (https://www.stnicholascenter.org/who-is-st-nicholas/stories-legends/classic-sources/michael-the-archimandrite ✔: “between 710 and 720”); 814–843 (https://www.stnicholascenter.org/who-is-st-nicholas/stories-legends/classic-sources/literary-development ✔: “According to Anrich this was probably written between 814 and 843; according to Cioffari about 700.”). Dấu vết sớm hơn: bài ca ngợi gán cho Proclus, năm 440 theo Lendering (early-sources ✔: “a laudatory speech by patriarch Proclus of Constantinople in 440”); trang literary-development: Proclus làm patriarch 434–447, Anrich cho là bản muộn không phải của Proclus, Cioffari cho là có thể thật hoặc 447–550 (m0d N10).

| # | Điểm | Trạng thái | Nguồn ✔ và cụm trích |
|---|---|---|---|
| N1 | Tôn kính ở Myra từ thế kỷ 4; mất ngày 6/12 năm không rõ; hài cốt về Bari 1087 | vững | https://www.stnicholascenter.org/who-is-st-nicholas/real-person/early-sources (Lendering): “The cult of Saint Nicholas started as early as the fourth century in the little port of Myra ... the venerable saint died on the sixth of December of an unknown year ... brought to Bari in Italy in 1087 ... This is about all we know with certainty.” |
| N2 | Không có tiểu sử cùng thời; mọi chuyện kể là muộn | vững | cùng trang: “There is no contemporary biography”; tiểu sử đầu tiên cách “about three and a half centuries” sau cái chết. https://en.wikisource.org/wiki/1911_Encyclop%C3%A6dia_Britannica/Nicholas,_St (✔): “His cult is as celebrated as his history is obscure. All the accounts that have come down to us are of a purely legendary character” |
| N3 | Ngài là giám mục thành Myra | theo truyền thống | cùng nguồn gọi ngài “the bishop of Myra” nhưng không có tư liệu cùng thời; 1911 Britannica: “bishop of Myra, in Lycia”. Không đặt vào “điều chắc” |
| N4 | Truyện của hồi môn cho ba cô gái | truyền thuyết / tranh cãi | https://www.stnicholascenter.org/who-is-st-nicholas/real-person/early-sources : “Nicholas hears about an impoverished man who is unable to offer a dowry to the men who will marry his three daughters”; “many stories have parallels in Philostratus' Life of Apollonius” (§6.39 có chuyện giúp một người nghèo có của hồi môn cho các con gái). Phía kia: https://www.stnicholascenter.org/who-is-st-nicholas/real-person/nicholas-of-patara (Cioffari): “The dowry can be considered historical in its essentials, because its three main recensions (Synaitic, Byzantine and Ethiopic) are very ancient and very different”; số cô gái khác nhau: “Here the girls are two ... The Ethiopic version has four girls ... the Byzantine tradition ... has three girls” |
| N5 | Chi tiết cửa sổ | vững là nội dung bản ghi, không phải sự thật lịch sử | Vita per Michaelem (bản dịch tiếng Anh trên St Nicholas Center, https://www.stnicholascenter.org/who-is-st-nicholas/stories-legends/classic-sources/michael-the-archimandrite ✔): ch.12 “After hurling a bag containing a large amount of gold into the house through the window at night”; ch.14 “he threw another bag of gold ... through the same window later at night”; ch.16 “he threw in through the same window a gift of gold”. Lendering: “he throws a purse through one of the windows of the house”. Không có ống khói, không có tất |
| N6 | Dự cảnh “nhà thổ” trong truyện | vững là nội dung bản ghi | Lendering trích Michael: “their father thought about ordering them to work in a brothel”. **Không dùng** trong Sổ tay, game không đùa chuyện nghèo (bible mục 8) |
| N7 | Dự Công đồng Nicêa | tranh cãi | Cioffari: “The participation in the council of Nicea is affirmed by Theodore the Lector, around 515 A.C. The lack of his name in the most ancient lists ...”. Lendering: “it is likely that he attended”. 1911 Britannica: “this last circumstance is ignored by all the historians, and ... St Athanasius ... never mentions Nicholas”. HĐGMVN nói như sự thật (mục 2.4) |
| N8 | Sinh năm 280 | thiếu nguồn | không nguồn nào mở được nêu năm sinh |
| N9 | Ngày lễ 6/12 | vững | 1911 Britannica: “honoured by the Greeks and the Latins on the 6th of December”; Lendering (N1) |

### Sổ tay `nicholas`

**Thẻ:**

> Thánh Nicôla được tôn kính ở Myra từ thế kỷ 4, mất ngày 6/12; hài cốt về Bari năm 1087.
> Về cuộc đời ngài, sử sách chắc rất ít.
> Chuyện ném túi vàng cho ba cô gái là truyền thuyết: người ta kể rằng.

**Đầy đủ:**

- **Sự thật.**
  - Việc tôn kính Thánh Nicôla bắt đầu ở Myra từ thế kỷ 4; ngài mất ngày 6/12 của một năm không rõ; hài cốt được đưa về Bari ở Ý năm 1087. Không có tiểu sử cùng thời. https://www.stnicholascenter.org/who-is-st-nicholas/real-person/early-sources
  - Tiểu sử còn lại sớm nhất, theo St Nicholas Center, là của Michael the Archimandrite. Niên đại còn tranh cãi. https://www.stnicholascenter.org/who-is-st-nicholas/stories-legends/classic-sources/michael-the-archimandrite ; https://www.stnicholascenter.org/who-is-st-nicholas/stories-legends/classic-sources/literary-development
  - Cioffari xếp tiểu sử ấy khoảng năm 700; Anrich và bản dịch Quinn–Sewell xếp 814–842/843; trang bản dịch của St Nicholas Center ghi 710–720. https://www.stnicholascenter.org/who-is-st-nicholas/stories-legends/classic-sources/literary-development ; https://www.stnicholascenter.org/who-is-st-nicholas/stories-legends/classic-sources/michael-the-archimandrite
  - Methodius, John the Deacon và Legenda aurea theo cùng một dòng truyền từ Michael, không phải nguồn độc lập. https://www.stnicholascenter.org/who-is-st-nicholas/stories-legends/classic-sources/literary-development
- **Truyền thuyết (“người ta kể rằng”).**
  - Người ta kể rằng một người cha nghèo không có của hồi môn cho ba cô con gái; ban đêm Nicôla ném một túi vàng qua cửa sổ nhà ấy, rồi lần nữa qua cùng cửa sổ cho cô thứ hai và cô thứ ba. https://www.stnicholascenter.org/who-is-st-nicholas/stories-legends/classic-sources/michael-the-archimandrite
  - Người ta kể rằng ngài dự Công đồng Nicêa; nguồn sớm nhất là khoảng năm 515. https://www.stnicholascenter.org/who-is-st-nicholas/real-person/nicholas-of-patara
- **Theo Kinh Thánh / theo truyền thống.** Không có ở chương này.
- **Tranh cãi (cả hai phía).**
  - Của hồi môn: Cioffari cho rằng cốt truyện có thể có thật vì ba dị bản rất cổ và rất khác nhau (hai, ba hoặc bốn cô gái). Lendering nêu chuyện có song song trong tiểu sử Apollonius của Philostratus, nhưng khác ở lý do can thiệp nên kết luận câu chuyện là có thật. Phía kia, Britannica 1911 gọi mọi tường thuật còn lại là thuần túy truyền thuyết, còn Anrich cho rằng khó tìm lại con người thật của ngài. https://www.stnicholascenter.org/who-is-st-nicholas/real-person/nicholas-of-patara ; https://www.stnicholascenter.org/who-is-st-nicholas/real-person/early-sources ; https://en.wikisource.org/wiki/1911_Encyclop%C3%A6dia_Britannica/Nicholas,_St
  - Công đồng Nicêa: có nguồn khoảng năm 515 nói ngài dự, nhưng các sử gia thời đó không nhắc, và Britannica 1911 ghi Athanasius không bao giờ nhắc tên ngài. https://www.stnicholascenter.org/who-is-st-nicholas/real-person/nicholas-of-patara ; https://en.wikisource.org/wiki/1911_Encyclop%C3%A6dia_Britannica/Nicholas,_St

## 11. Phần chưa kiểm chứng (không vào Sổ tay)

- Bản ghi sớm hơn Bede cho tên Yule (lịch Gothic): chỉ có blog (○).
- Heimskringla: ngày “Dec. 14” và cách Snorri tính lịch; không dùng.
- Thời điểm thêm chuồng, bò, lừa vào cảnh Giáng Sinh (B7).
- “Chín tháng” từ 25/3 trong nguồn học thuật (D9).
- Năm Aurelian lập lễ Sol Invictus (274): chỉ NatGeo; Penelope không nêu; Hijmans phản bác việc coi Aurelian là người “đưa trở lại” sự thờ Sol.
- Tầm gửi trong Saturnalia (S10) và mọi nối kết Baldur, Pliny với tục hôn (M7).
- Livy 2.21: ngày tháng chỉ theo chú thích Loeb; không mở được bản đồng thời với Livy, bản Fasti Antiates Maiores chưa mở.
- Năm sinh Thánh Nicôla (280).
- Dạng “Libêriô” ở HĐGMVN (không tìm thấy; dùng nguồn Tổng Giáo phận Sài Gòn).
- Các trang Britannica hiện hành về Thánh Nicôla, Cicero, Livy, Bede, Yule bị cắt hoặc không mở được; không trích.
- Khả năng Hijmans, Nothaft (doi), Brill (Croy) chỉ đọc phần trích/tóm tắt; Sổ tay chỉ dùng điều tóm tắt nêu.
