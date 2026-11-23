# M0b, hồi 3 (act 3): kiểm chứng `yule-lads`, `yule-cat`, `santa-ny`, `caga-tio`, `dickens`, `brooms`

Ngày 2026-11-17. Bible đọc tại commit `d64133e` (đã có cột "Dấu"); `story/minigames.json` cùng commit. Chỉ link ✔ (đã mở và thấy cụm trích) được dùng trong Sổ tay. Trích dẫn tiếng nước ngoài để nguyên văn; bản quét có OCR thì ghi "(OCR)" và chỉ sửa lỗi chữ rõ ràng. Wikipedia chỉ dùng để lần nguồn, không trích.

## 1. Kết quả

| Chương | Kết luận | Cần sửa bible |
|---|---|---|
| `yule-lads` | OK (có ghi chú) | Nhãn DG và Mốc "khoảng 1850" giữ được (tranh cãi 9 hay 13 có ghi giữa thế kỷ 19). Lưu ý: con số 13 đã có từ thế kỷ 18 và 13 tên đã in năm 1862, nên đừng viết như thể 13 chỉ ra đời năm 1932. |
| `yule-cat` | Cần sửa | "việc len" hẹp hơn nguồn; Mốc nên là 1864 (không phải 1862, không phải "khoảng 1860"). Nhãn DG † giữ nguyên. |
| `santa-ny` | Cần sửa nhẹ | "Coca-Cola chỉ góp phần phổ biến" thấp hơn lời chính công ty; ghi ngày số báo Nast; "thường gán cho Moore" nên mềm hơn. Nhãn DG, Mốc 1823 đúng. |
| `caga-tio` | Cần sửa nhẹ | "cách đây khoảng 150 năm" đổi sang mốc tuyệt đối; dòng Quạ Đồn "tế lễ mặt trời" chưa có nguồn. Mốc "thế kỷ 19" xác nhận (bản ghi sớm nhất tìm được: 1886). Nhãn DG † đúng. |
| `dickens` | Cần sửa | "bán đại trà" (3 chỗ) sai: nguồn nói "thương mại", in 1.000 tấm, và hai bảo tàng bất đồng việc bán có chạy hay không. Nhãn DG, Mốc 1843 đúng. |
| `brooms` | Cần sửa | Link "Scandinavian Christmas Traditions" là bản chép lại sách Miles 1912 đã bỏ chữ "In Sweden": chuyện phù thủy cưỡi chổi hoặc xẻng là của Thụy Điển. Giấu chổi vẫn thiếu nguồn và nguồn còn mâu thuẫn về chiều (giấu trong nhà hay để ngoài cửa). Nhãn DG † và "chưa rõ năm" giữ được. |

Tóm tắt các điểm chính:

- **Yule Cat 1862 hay 1864:** 1864. Tôi đọc bản quét gốc: tập I (đề "1862") không có chữ `jólakött`; tập II (trang đề "ANNAÐ BINDI … LEIPZIG … 1864") có đoạn về jólaköttur ở tr. 570. Viện Árni Magnússon cũng ghi nguồn sớm nhất là Jón Árnason II:570. Con số 1862 trên Wikipedia là năm của tập I. Không tìm được trang nào của Þjóðminjasafn Íslands nói về bản ghi sớm nhất của Mèo Yule (xem mục 4).
- **Caga Tió "thế kỷ 19":** đúng. Bài hát đập Tió in trong sách Cortils i Vieta, Blanes, 1886 (qua Càntut, chưa mở bản gốc); nhà nhân học Fornés nói bài hát "khoảng 150 năm" (tin 2020).
- **Moore/Livingston:** chưa ngã ngũ. Các nguồn khác nhau về mức nghiêng: NYSL nói tranh cãi "chưa bao giờ được giải quyết dứt điểm"; Poetry Foundation viết "thường được gán cho Livingston ngày nay".
- **Nast 1863:** số báo Harper's Weekly đề ngày 3/1/1863 (bìa "Santa Claus in Camp"), vẽ cho mùa Giáng Sinh 1862. HarpWeek dùng "chuẩn hóa", OSU dùng "phát minh" trong ngoặc kép kèm lời "bỏ qua nhiều thế kỷ tiền thân".
- **Coca-Cola:** chính công ty nói không tạo ra Santa; Santa đã mặc áo đỏ trước Sundblom (1931).
- **Na Uy, đêm Giáng Sinh:** nguy hiểm là có nguồn (SNL, Norsk Folkemuseum, NRK). Giấu chổi: không có nguồn học thuật nào; chỉ có tin tổng hợp, tài liệu giáo dục và blog, và một sử gia kể ngược lại (chổi để ngoài cửa).

## 2. Danh sách sửa bible (gộp)

1. Dòng 98 `yule-lads`: không bắt buộc sửa. Giữ Mốc "khoảng 1850"; chỉ cần Sổ tay và lời chương nói rõ 13 chàng đã có trước 1932 (13 tên in năm 1862; con số 13 trong bản chép tay thế kỷ 18) và 1932 là lúc chốt tên, số lượng, thứ tự đến.
2. Dòng 99 và `minigames.json` `yule-cat`: "xong việc len" → "xong mọi việc chuẩn bị Giáng Sinh (đan, may áo, nướng bánh, nấu bia…)"; Mốc "khoảng 1860" → "1864".
3. Dòng 100 `santa-ny`: "Coca-Cola chỉ góp phần phổ biến" → "Coca-Cola không tạo ra ông già Noel; từ 1931 quảng cáo của họ góp phần định hình hình ảnh (theo chính công ty), và áo đỏ đã có trước đó". "Nast" kèm "từ số báo 3/1/1863". "Người ta thường gán cho Moore" → "Lâu nay gán cho Moore; một số nguồn ngày nay nghiêng về Livingston; chưa ngã ngũ".
4. Dòng 101 `caga-tio`: "ghi cách đây khoảng 150 năm" → "chỉ thấy ghi từ cuối thế kỷ 19" (không dùng "cách đây N năm" vì sẽ lỗi thời). `minigames.json` `caga-tio` "songs are about 150 years old" → "songs recorded since the late 19th century". Dòng Quạ Đồn "tàn dư tế lễ mặt trời cổ" → "gốc là nghi lễ ngoại giáo mùa đông cổ" (NPR: tục ngoại giáo mừng đông chí; Betevé: "cultes ancestrals"; "mặt trời" và Joan Amades chưa mở được nguồn).
5. Dòng 71, dòng 102 và `minigames.json` `dickens`: "đại trà / mass-produced" → "thương mại / commercially produced".
6. Dòng 103 `brooms`: thay link Scandinavian Christmas Traditions bằng Miles 1912 (mục 3.6); ghi "phù thủy cưỡi chổi hoặc xẻng" là tin của Thụy Điển. Dấu SỰ THẬT chỉ đứng vững cho "đêm này từng bị coi là nguy hiểm"; phần "vì sao" là nhận định của bảo tàng ("kan vi anta"), nếu chương trả lời "vì sao" thì ghi là nhận định và cân nhắc dấu TRANH CÃI.

## 3. Từng chương

### 3.1 `yule-lads` — Yule Lads (DG, Mốc cần sửa, Dấu SỰ THẬT)

**Nhãn và Mốc.** DG đúng. Mốc "khoảng 1850" giữ được: Jón Samsonarson (1979, tr. 164): "Tala jólasveina hefur verið á reiki, sumir töldu að þeir ættu að vera þrettán, aðrir sögðu níu. Um þetta voru skiptar skoðanir um miðja 19. öld." Nhưng đây không phải bản ghi sớm nhất của con số 13: cùng bài viết nói "Elsta heimild um töluna þrettán, sem ég minnist að hafa séð, er í Grýlukvæði í Lbs. 1694 8vo. Skrifari er ókunnur, en skriftin bendir til átjándu aldar" (nguồn sớm nhất về con số 13 mà tác giả nhớ đã thấy là bài Grýlukvæði trong bản chép tay, nét chữ cho thấy thế kỷ 18; "1694" là số kệ sách, không phải năm). Đó là một học giả, có rào đón. Chưa xác minh được "bài thơ Grýla thế kỷ 17" của bible, vẫn không dùng.

**Mệnh đề và nguồn**

| Mệnh đề | Trạng thái | Nguồn ✔ và cụm chứng minh |
|---|---|---|
| Bài thơ "Jólasveinarnir" trong Jólin koma (1932, Jóhannes úr Kötlum) chốt tên, số lượng, thứ tự đến của các chàng; 13 chàng "chính thức" | vững | https://landsbokasafn.is/en/yule-lads-jolin-koma/ : "With this poem Jóhannes can be said to have fixed the names of the Yule Lads, their number and the order in which they come to the settlements." https://landsbokasafn.is/en/jolin-koma-christmas-arrives-finished/ : "established what is now considered the ‘official’ thirteen Yule Lads" |
| Tên phần lớn lấy từ mục sư Páll Jónsson ở Myrká, khoảng 70 năm trước, trong sưu tập Jón Árnason | vững | https://landsbokasafn.is/en/yule-lads-jolin-koma/ : "mostly used the same names for the lads as Rev. Páll Jónsson of Myrká (1812–1889) had done seventy years earlier in Jón Árnason’s collection of folk tales" |
| Sách in 1862 đã liệt kê 13 tên và nói có người cho là chỉ 9 | vững | Bản quét Jón Árnason, tập I (Leipzig 1862), tr. 219–220: https://archive.org/download/Islenzkarthjodso000197672v1JonReyk/Islenzkarthjodso000197672v1JonReyk_orig_djvu.txt (OCR) : "Jólasveinar héita svo eiginlegum nöfnum: 1. Stekkjarstaur, 2. Giljagaur, 3. Stúfur …" và "að jólasveinar hafi verið 13 að tölu, hefir þó ekki öllum borið saman um það atriði … segja sumir, að þeir hafi ekki verið fleiri en 9"; vần "Jólasveinarnir einn og átta". Trang đề: "FYRSTA BINDI … 1862". |
| Số lượng "trôi nổi" giữa thế kỷ 19: có người 13, có người 9 | vững | https://timarit.is/page/5400133 (Jón Samsonarson, Íslenskt mál og almenn málfræði 1979, tr. 164; tên bài chưa lấy được): "Tala jólasveina hefur verið á reiki, sumir töldu að þeir ættu að vera þrettán, aðrir sögðu níu. Um þetta voru skiptar skoðanir um miðja 19. öld." |
| Trước năm 1862 chưa thấy tên chàng nào; chàng thứ bảy trong sách 1862 là Faldafeykir | vững (một học giả) | https://arnastofnun.is/is/utgafa-og-gagnasofn/pistlar/nofn-jolasveina (Árni Björnsson, Árnastofnun): "Nöfn á jólasveinum sjást hinsvegar engin fyrr en í Þjóðsögum Jóns Árnasonar árið 1862 (I:219)"; danh sách 13 tên theo thứ tự ở cùng trang. Đã kiểm ở research/m0c-puzzles.md §2 Y2, Y3. |
| Lịch ngày nay: chàng đầu đến 12/12, mỗi ngày một chàng, chàng cuối (Kertasníkir) đến 24/12; chàng thứ bảy là Hurðaskellir | vững | https://www.visindavefur.is/svar.php?id=5491 (Gróa Finnsdóttir và Árni Björnsson, Vísindavefur): "12. desember byrja gömlu jólasveinarnir að koma til byggða", "Kertasníkir kemur á aðfangadag, 24. desember". Đã kiểm ở research/m0c-puzzles.md §2 Y5. |
| Số 13 đã có trong bản chép tay thế kỷ 18 | vững nhưng một học giả, có rào đón | https://timarit.is/page/5400133 : câu "Elsta heimild um töluna þrettán …" ở trên, kèm "Laungnm leidir beinar labba Jölasveinar … 13 saman meinar" (OCR) |
| Đầu thế kỷ 20 họ còn bị xem như troll; tranh 1932 làm họ giống nông dân; dần pha giữa troll Iceland và ông già Noel Mỹ | vững | https://landsbokasafn.is/en/yule-lads-jolin-koma/ : "In the first half of the 20th century the Icelandic Yule Lads were seen as trolls, but Tryggvi’s Yule Lads are more like farmers"; "gradually a compromise grew up between the Icelandic trolls and the American Santa Claus" |
| Chàng đầu đến 13 ngày trước Giáng Sinh, mỗi ngày thêm một chàng, chàng cuối đến 24/12; đi theo thứ tự đó đến Lễ Hiển Linh | truyền thuyết | Jón Árnason I tr. 219 (OCR, cùng file): "hinn fyrsti kemur 13 dögum fyrir jól … sá síðasti á aðfángadag jóla"; "á þrettánda dag jóla" |
| Họ là con của Grýla và Leppalúði | truyền thuyết | https://landsbokasafn.is/en/jolin-koma-christmas-arrives-finished/ : "traditionally said to be the sons of the mountain-dwelling trolls Grýla and Leppalúði" (bible không dùng Grýla; để ngoài Sổ tay) |
| "82 chàng"; bài thơ Grýla thế kỷ 17 | thiếu nguồn | Không mở được nguồn. Không dùng. |

**Dòng bible:** giữ; câu an toàn cho Sổ tay và lời chương: "Ngày nay có 13 chàng Yule. Con số này đã có trong một bản chép tay thế kỷ 18; tên từng chàng và quy tắc đến chỉ thấy từ sách in năm 1862, và khi ấy vẫn có người nói chỉ có 9."

### Sổ tay `yule-lads`

**Thẻ:**

> Người Iceland ngày nay nói có 13 chàng Yule; lịch đếm từ 12/12 đến 24/12, mỗi ngày một chàng.
> Con số 13 đã có trong một bản chép tay thế kỷ 18.
> Tên từng chàng và quy tắc đến chỉ thấy từ sách in năm 1862, và khi ấy vẫn có người nói chỉ có 9.

**Đầy đủ:**

- **Sự thật.**
  - Con số 13 có trong một bản chép tay của bài Grýlukvæði. Không rõ ai chép; học giả Jón Samsonarson xếp bản ấy vào thế kỷ 18 theo nét chữ, và viết rằng đó là nguồn sớm nhất về con số 13 mà ông nhớ đã thấy. https://timarit.is/page/5400133
  - Sách truyện dân gian của Jón Árnason in năm 1862 liệt kê 13 tên, do mục sư Páll Jónsson ở Myrká cung cấp; chàng thứ bảy trong sách là Faldafeykir. Theo học giả Árni Björnsson, trước năm 1862 chưa thấy tên chàng nào. https://archive.org/download/Islenzkarthjodso000197672v1JonReyk/Islenzkarthjodso000197672v1JonReyk_orig_djvu.txt ; https://landsbokasafn.is/en/yule-lads-jolin-koma/ ; https://arnastofnun.is/is/utgafa-og-gagnasofn/pistlar/nofn-jolasveina
  - Lịch Iceland ngày nay: chàng đầu đến ngày 12/12, mỗi ngày thêm một chàng, chàng cuối đến ngày 24/12; chàng thứ bảy là Hurðaskellir. Thư viện Quốc gia Iceland nói bài thơ "Jólasveinarnir" trong tập Jólin koma (1932) của Jóhannes úr Kötlum đã cố định tên, số lượng và thứ tự đến của các chàng. https://www.visindavefur.is/svar.php?id=5491 ; https://landsbokasafn.is/en/yule-lads-jolin-koma/ ; https://landsbokasafn.is/en/jolin-koma-christmas-arrives-finished/
  - Đầu thế kỷ 20 người ta còn xem họ như troll; tranh minh họa 1932 vẽ họ giống nông dân, và dần dần họ pha giữa troll Iceland và ông già Noel Mỹ: biết tặng quà nhưng vẫn giữ trò tinh nghịch. https://landsbokasafn.is/en/yule-lads-jolin-koma/
- **Truyền thuyết.**
  - Người ta kể rằng chàng đầu tiên xuống núi 13 ngày trước Giáng Sinh, mỗi ngày thêm một chàng, chàng cuối cùng đến đúng ngày 24/12. https://archive.org/download/Islenzkarthjodso000197672v1JonReyk/Islenzkarthjodso000197672v1JonReyk_orig_djvu.txt
- **Tranh cãi.**
  - Phía 13: Jón Árnason (1862) viết rằng dường như chắc chắn họ có 13 người, và bản chép tay thế kỷ 18 của bài Grýlukvæði cũng nói 13. https://archive.org/download/Islenzkarthjodso000197672v1JonReyk/Islenzkarthjodso000197672v1JonReyk_orig_djvu.txt ; https://timarit.is/page/5400133
  - Phía 9: có người dẫn vần "Jólasveinarnir einn og átta" để nói chỉ có 9; giữa thế kỷ 19 ý kiến còn chia. https://timarit.is/page/5400133
- *Theo Kinh Thánh hoặc theo truyền thống:* không có; ẩn mục.

**Ghi chú cho người viết:** Landsbókasafn nhắc các nhân vật dân gian liên quan có loại "homicidal monsters who eat children"; đừng đưa vào lời kể.

---

### 3.2 `yule-cat` — Mèo Yule (DG †, Mốc cần sửa thành 1864, Dấu TRUYỀN THUYẾT)

**1862 hay 1864.** Bản quét tập II của Jón Árnason có trang đề "ANNAÐ BINDI … LEIPZIG … 1864" (OCR "ANNAB BINDI") và đoạn jólaköttur ở trang đánh số 570, mục "VENJUR". Tập I (trang đề 1862) không có `jólakött` (tìm cả khi chữ bị ngắt dòng). Viện Árni Magnússon ghi "II:570". Bản ghi truyền miệng sớm hơn: lời Árni Sigurðsson ở Breiðdalur khoảng giữa thế kỷ 19, nhưng chỉ chép ra giấy năm 1911 (Hrefna S. Bjartmarsdóttir, bbl.is). Kết luận: bản in sớm nhất 1864. Þjóðminjasafn Íslands: không tìm thấy trang nào nêu bản ghi sớm nhất; chỉ có lời trích "heimildamönnum þjóðháttadeildar Þjóðminjasafns" trong bài Vísindavefur, không có năm.

**Nhãn và Mốc.** DG † đúng (nguồn xưa chỉ từ giữa thế kỷ 19; vài học giả cho gốc cổ, chưa chứng minh). Mốc nên là 1864; "khoảng 1860" chấp nhận được nhưng không chính xác.

**Mệnh đề và nguồn**

| Mệnh đề | Trạng thái | Nguồn ✔ và cụm chứng minh |
|---|---|---|
| Bản in sớm nhất: Jón Árnason, tập II, Leipzig 1864, tr. 570 | vững | https://archive.org/details/Islenzkarthjodso000197672v2JonReyk (txt: https://archive.org/download/Islenzkarthjodso000197672v2JonReyk/Islenzkarthjodso000197672v2JonReyk_orig_djvu.txt) trang đề 1864. https://arnastofnun.is/is/greinar/jolakottur : "Sagnir um jólaköttinn eru ekki gamlar. Elsta heimild í Ritmálssafni Orðabókar Háskólans er úr Íslenzkum þjóðsögum og ævintýrum sem Jón Árnason safnaði saman um miðja 19. öld (II:570)." https://www.bbl.is/skodun/a-faglegum-notum/jolakotturinn-%E2%80%93-uppruni-hans-aettir-og-hlutverk : "Frásögn um jólaköttinn birtist fyrst á prenti í þjóðsögum Jóns Árnasonar árið 1864." |
| Nội dung 1864: ai không có áo mới "đi vào Mèo"; nó tóm (ăn?) họ, hoặc ít nhất lấy phần ăn Giáng Sinh | vững | Jón Árnason II tr. 570 (OCR): "var það trú, að sú óvættur væri þá á ferð, sem var kallaður jólaköttur. Hann gerði reyndar eingum þeim mein, sem eignuðust einhverja nýa flík … en hinir, sem ekkert nýtt fat feingu, ‚fóru allir í jólaköttinn‘, svo hann tók (át?) þá, eða að minnsta kosti jólarefinn þeirra". Dấu hỏi là của chính Jón Árnason: bản gốc không chắc nó "ăn". |
| Truyện sau này kể mèo ăn trẻ em không có áo mới | truyền thuyết | https://landsbokasafn.is/en/jolin-koma-christmas-arrives-finished/ : "a beast that, according to folklore, eats children that don’t receive new clothes in time for Christmas" |
| Vai trò: thúc mọi người làm xong việc chuẩn bị Giáng Sinh | vững là cách giải thích của giới dân tộc học | https://www.visindavefur.is/svar.php?id=5511 (Hrefna S. Bjartmarsdóttir, nhà dân tộc học): "Að fylgjast með jólaundirbúningi manna og sjá til þess þeir klári öll verk sem vinna þarf fyrir jólin, hvort sem það er að prjóna og vinna fatnað, baka, brugga eða útbúa jólamatinn." Jón Árnason II tr. 570 (OCR): "Af þessu keptust allir við, bæði börn og hjú, að vinna til þess af húsbændum sínum fyrir jólin, að fá eitthvert nýtt fat" (vì thế cả trẻ lẫn người làm đều gắng làm việc cho chủ để xin áo mới); chú thích 2 (OCR), nói về các hình phạt đi kèm cho ai không có áo mới: chúng có vẻ dùng cho trẻ "sem voru löt að læra og ljúka við það, sem þau áttu að vera búin með fyrir jólin" (lười học và lười làm xong việc trước Giáng Sinh). |
| Gốc và tuổi: chưa ai biết; nhiều giả thuyết | tranh cãi | https://www.bbl.is/skodun/a-faglegum-notum/jolakotturinn-%E2%80%93-uppruni-hans-aettir-og-hlutverk : "Hversu gömul hún er þessi þjóðtrú um köttinn í tengslum við undirbúning jóla, er ekki vitað né hvernig hún varð til." (bản đầy đủ của câu "Hversu gömul …": tuổi của tín ngưỡng về con mèo gắn với việc chuẩn bị Giáng Sinh thì không ai biết, cũng không biết nó đã hình thành thế nào); Árni Björnsson þjóðháttafræðingur (nhà nghiên cứu phong tục lễ hội dân tộc): "Árni Björnsson telur að munnmæli um jólahafurinn hafi borist hingað frá Noregi einhvern tímann á tveimur síðastliðnum öldum og haft áhrif á að til urðu sagnir um jólaköttinn. Hann segir enn fremur að þar sem geitur hafi verið fátíðar hér og óþekktar sem óvættir hafi kötturinn orðið fyrir valinu og vísar í þekktar sagnir um kattarskrímsli í þjóðtrúnni máli sínu til stuðnings." (lời đồn về dê Yule đã sang Iceland từ Na Uy vào lúc nào đó trong hai thế kỷ gần đây và làm nảy sinh truyện về Mèo Yule; vì dê hiếm ở đây và không được biết đến như quái vật nên con mèo được chọn, ông dẫn các truyện về quái vật mèo trong dân gian làm bằng chứng); Guðmundur Ólafsson fornleifafræðingur (nhà khảo cổ): "Guðmundur Ólafsson fornleifafræðingur er þessu ekki sammála og telur líklegt að jólakötturinn sé mun eldri í þjóðtrú okkar Íslendinga." (không đồng ý với điều đó và cho rằng Mèo Yule có lẽ cổ hơn nhiều trong tín ngưỡng của người Iceland; giả thuyết của ông: mèo và dê Yule là hậu duệ của con quỷ đi cùng Thánh Nicôla); Árni Björnsson, Lily Weiser-Aall và Terry Gunnell: thành ngữ "fara í jólaköttinn" có thể từng mang nghĩa "mặc hóa trang thành mèo", như thành ngữ Na Uy "att gå buck" (giả thuyết: "ekki þekkist innlendar heimildir þess efnis"); tác giả bài tự suy ra "jólakötturinn eigi sér aldagamlar rætur þó ekki sé vitað um eldri heimildir um hann hérlendis en frá því um miðja 19. öld" (dựa vào tục xấu hổ khi không có áo mới ở Scotland khoảng 1500); https://www.visindavefur.is/svar.php?id=5511 : "Fræðimenn telja almennt að þessar jólavættir eigi sér mjög fornar sameiginlegar rætur í heiðni." |
| Mèo Yule có từ thời Viking | thiếu nguồn | Không nguồn nào nêu bản ghi trước giữa thế kỷ 19 (Árnastofnun, bbl.is ở trên). |
| Tục xấu hổ khi không có áo mới ở thơ Scotland khoảng 1500 (Dunbar) | thiếu nguồn gốc | Chỉ thấy qua bbl.is (tác giả không dẫn bản thơ); chưa mở bản gốc. Không dùng. |

**Dòng bible cần sửa:** mục 2, điểm 2. Thêm: "người bị ăn" chỉ là phiên bản kể sau; bản 1864 dùng "tóm (ăn?) … hoặc ít nhất lấy phần ăn". Câu an toàn đã sửa: "Mèo Yule chỉ thấy trong sách in từ năm 1864; người ta thường giải thích đó là cách thúc mọi người làm xong việc chuẩn bị trước Giáng Sinh, kể cả đan và may áo."

### Sổ tay `yule-cat`

**Sổ tay: thẻ 2–3 dòng**

> Mèo Yule (Jólakötturinn) là con quái vật trong truyện dân gian Iceland, nhắm vào những ai không có áo mới trước Giáng Sinh. Bản in sớm nhất là sách của Jón Árnason năm 1864; người ta thường giải thích đó là cách thúc mọi người xong việc chuẩn bị trước lễ.

**Sổ tay: bản đầy đủ**

*Sự thật*
- Bản in sớm nhất còn biết nằm trong tập II sưu tập truyện dân gian của Jón Árnason (Leipzig, 1864), tr. 570. Viện Árni Magnússon nhận xét truyện về Mèo Yule "không cổ". [Bản quét tập II](https://archive.org/details/Islenzkarthjodso000197672v2JonReyk), [Árnastofnun](https://arnastofnun.is/is/greinar/jolakottur)
- Trong bản 1864, ai không có áo mới thì "đi vào Mèo": nó tóm họ (ông ghi thêm dấu hỏi, "ăn?"), hoặc ít nhất lấy phần ăn Giáng Sinh của họ. [Bản quét tập II](https://archive.org/details/Islenzkarthjodso000197672v2JonReyk)
- Giới dân tộc học giải thích: các "vật dọa Giáng Sinh" như thế giám sát việc chuẩn bị lễ để mọi người xong việc (đan, may áo, nướng bánh, nấu bia, làm bữa tiệc). Chính Jón Árnason ghi rằng ai cũng gắng làm việc cho chủ để xin áo mới, và nhận xét các hình phạt đi kèm có vẻ dùng cho trẻ lười học và lười làm xong việc trước Giáng Sinh. [Vísindavefur](https://www.visindavefur.is/svar.php?id=5511), [Bản quét tập II](https://archive.org/details/Islenzkarthjodso000197672v2JonReyk)

*Truyền thuyết ("người ta kể rằng")*
- Người ta kể rằng con mèo ăn những đứa trẻ không kịp có áo mới trước Giáng Sinh. [Landsbókasafn](https://landsbokasafn.is/en/jolin-koma-christmas-arrives-finished/)

*Tranh cãi: cổ hay mới?*
- Phía "mới": Árni Björnsson cho rằng truyện từ Na Uy (con dê Yule) sang Iceland trong khoảng hai thế kỷ gần đây. [bbl.is](https://www.bbl.is/skodun/a-faglegum-notum/jolakotturinn-%E2%80%93-uppruni-hans-aettir-og-hlutverk)
- Phía "cổ hơn": nhà khảo cổ Guðmundur Ólafsson cho là mèo và dê cùng hậu duệ của con quỷ đi cùng Thánh Nicôla, nên cổ hơn nhiều; tác giả bài báo suy ra tục có gốc nhiều thế kỷ vì tục xấu hổ khi không có áo mới đã có ở Scotland khoảng 1500; Vísindavefur viết rằng học giả nhìn chung cho các vật dọa Giáng Sinh có chung gốc rất cổ từ thời ngoại giáo. Nhưng chưa có bản ghi nào về chính Mèo Yule trước giữa thế kỷ 19. [bbl.is](https://www.bbl.is/skodun/a-faglegum-notum/jolakotturinn-%E2%80%93-uppruni-hans-aettir-og-hlutverk), [Vísindavefur](https://www.visindavefur.is/svar.php?id=5511)

*Theo Kinh Thánh hoặc theo truyền thống:* không có; ẩn mục.

**Ghi chú cho người viết:** bible cấm đùa việc thiếu áo; cả bản 1864 lẫn Vísindavefur đều nói về hình phạt, nên giữ giọng "truyện dọa", đừng kể như chuyện thật đã xảy ra. Mini game "kéo len" là minh họa, không phải mô tả tục.

---

### 3.3 `santa-ny` — New York 1823 (DG, Mốc 1823 đúng, Dấu TRANH CÃI)

**Nhãn và Mốc.** DG, 1823: xác nhận (đăng trên Troy Sentinel ngày 23/12/1823).

**Mệnh đề và nguồn**

| Mệnh đề | Trạng thái | Nguồn ✔ và cụm chứng minh |
|---|---|---|
| Bài thơ đăng nặc danh trên Troy Sentinel, 23/12/1823 | vững | https://www.mcny.org/story/clement-clarke-moore-and-santa-city : "first published anonymously in the Troy Sentinel on December 23, 1823". https://nysl.nysed.gov/collections/stnick/ : "originally published in the Troy Sentinel, on December 23, 1823. It appeared without attribution". https://www.britannica.com/topic/A-Visit-from-St-Nicholas : "first published anonymously in the Troy Sentinel (a New York newspaper) on December 23, 1823" (trang rút gọn, chỉ đọc được phần đầu) |
| Gán cho Moore năm 1837 (Hoffman); Moore nhận năm 1844 | vững | MCNY: "Authorship was not attributed to Moore until 1837, and Moore himself did not claim the poem as his own until 1844". NYSL: "In New-York Book of Poetry, in 1837, Charles Fenno Hoffman identified his friend Clement Moore as the author". |
| Tác giả: Moore hay Henry Livingston Jr. | tranh cãi | NYSL: "The controversy has never been definitively settled"; "public opinion seems to be shifting toward Livingston"; phía Moore: Nissenbaum, Seth Kaller, Joe Nickell; phía Livingston: Don Foster. Columbia: "There is no record of his ever having claimed authorship of ‘A Visit,’ and no physical evidence linking him to the poem" (https://magazine.columbia.edu/article/story-behind-most-famous-christmas-poem-all). MCNY: "does not take a position on this issue". https://www.poetryfoundation.org/poets/clement-clarke-moore : "Authorship is typically attributed now to Major Henry Livingston , Jr." |
| Moore góp nhiều nét ông già Noel Mỹ: béo tròn, vui, xe trượt tuyết tuần lộc, đêm Giáng Sinh | vững (nếu Moore hay Livingston là tác giả thì vẫn là nét của bài thơ) | Columbia: "endowed his St. Nick with other traits that would come to define the American Santa Claus: a plump, jolly, cherry-nosed, white-bearded chimney spelunker whose toy-packed sleigh, drawn by team of reindeer" |
| Nast vẽ Santa lần đầu: số Harper's Weekly đề 3/1/1863, "Santa Claus in Camp" | vững | https://library.osu.edu/thomas-nast/santa-claus : "Santa Claus in Camp,” Harper's Weekly, January 3, 1863, cover"; "Nast first drew Santa Claus for the 1862 Christmas season". https://www.harpweek.com/09cartoon/BrowseByDateCartoon.asp?Date=25&Month=December : "His first Santa (in the postdated January 3, 1863 issue) is a small elf distributing Christmas presents to Union soldiers in camp." |
| "Nast phát minh ông già Noel" | tranh cãi / nói quá | OSU: "The claim that Nast ‘invented’ Santa Claus in 1862 is thus accurate, but the assertion overlooks the centuries-long antecedents to his invention." HarpWeek: "Before Nast, different regions, ethnic groups, and artists in the United States presented Santa Claus in various ways"; "Nast was instrumental in standardizing and nationalizing the image". |
| "Santa Claus and His Works" (HarpWeek ghi ngày 25/12/1866); bản minh họa thơ Moore 1869 đổi áo sang đỏ; Nast có thể là người đầu tiên gắn Bắc Cực | vững là nhận định của HarpWeek | HarpWeek cùng trang: "Three years later, in 1869 … Santa’s suit was changed to the red color"; "Nast may have been the first illustrator to so identify the locale". |
| Coca-Cola tạo ra ông già Noel áo đỏ | sai, theo chính Coca-Cola | https://www.coca-cola.com/us/en/about-us/faq/did-coca-cola-create-santa-claus : "Coca‑Cola did not create the legend of Santa Claus. But Coca‑Cola advertising did play a big role in shaping the jolly character we know today."; "Before 1931, there were many different depictions of Santa Claus". https://www.coca-colacompany.com/about-us/history/haddon-sundblom-and-the-coca-cola-santas : "Santa appeared in a red coat before Sundblom painted him."; năm 1931 hãng thuê Haddon Sundblom. Lưu ý: đây là lời của công ty, và hai trang của họ lệch nhau về năm bài thơ (1822 và 1823). |
| Người Hà Lan mang Sinterklaas sang New York | tranh cãi | Không dùng (bible đã loại). Columbia nêu: "in America, St. Nicholas was barely known outside the old Dutch community". |

**Dòng bible cần sửa:** mục 2, điểm 3. Thêm: đừng viết Moore "viết năm 1822" như sự thật: Columbia và FAQ của Coca-Cola ghi 1822 cho Moore, trang công ty của Coca-Cola ghi 1823, và việc Moore là tác giả đang tranh cãi; chỉ khẳng định bài thơ in năm 1823.

### Sổ tay `santa-ny`

> Bài thơ "A Visit from St. Nicholas" đăng nặc danh trên báo Troy Sentinel ngày 23/12/1823; lâu nay gán cho Clement Clarke Moore, nhưng có người cho là Henry Livingston Jr. và chưa ngã ngũ. Hình ông già Noel do nhiều họa sĩ định hình dần, trong đó có Thomas Nast từ năm 1863; Coca-Cola nói chính họ không tạo ra ông.

**Sổ tay: bản đầy đủ**

*Sự thật*
- Bài thơ đăng nặc danh ngày 23/12/1823 trên Troy Sentinel; tên Moore xuất hiện năm 1837, và Moore tự nhận năm 1844. [MCNY](https://www.mcny.org/story/clement-clarke-moore-and-santa-city), [NYSL](https://nysl.nysed.gov/collections/stnick/)
- Bài thơ góp nhiều nét của ông già Noel Mỹ: người béo tròn vui vẻ, xe trượt tuyết do tuần lộc kéo, đi vào đêm Giáng Sinh. [Columbia](https://magazine.columbia.edu/article/story-behind-most-famous-christmas-poem-all)
- Thomas Nast vẽ ông già Noel đầu tiên cho số Harper's Weekly đề 3/1/1863; ông tiếp tục vẽ đến năm 1886 và có sức ảnh hưởng lớn đến hình dáng ngày nay. Trước Nast đã có nhiều hình khác nhau, kể cả một ông già không râu có xe kéo bởi gà tây (1858). [OSU](https://library.osu.edu/thomas-nast/santa-claus), [HarpWeek](https://www.harpweek.com/09cartoon/BrowseByDateCartoon.asp?Date=25&Month=December)
- Năm 1931 Coca-Cola thuê họa sĩ Haddon Sundblom vẽ ông già Noel cho quảng cáo. Chính công ty nói họ không tạo ra ông già Noel, và ông đã mặc áo đỏ trước đó. [Coca-Cola](https://www.coca-cola.com/us/en/about-us/faq/did-coca-cola-create-santa-claus), [Coca-Cola 2](https://www.coca-colacompany.com/about-us/history/haddon-sundblom-and-the-coca-cola-santas)

*Truyền thuyết ("người ta kể rằng")*
- Người ta hay kể rằng Coca-Cola "phát minh" ông già Noel áo đỏ, hoặc Nast "phát minh" ra ông. Cả hai đều quá lời: hình ảnh này hình thành dần qua nhiều tay. [Coca-Cola](https://www.coca-cola.com/us/en/about-us/faq/did-coca-cola-create-santa-claus), [OSU](https://library.osu.edu/thomas-nast/santa-claus)

*Tranh cãi: ai viết bài thơ?*
- Phía Moore: bài thơ gán cho ông từ 1837, ông nhận năm 1844; một số nhà nghiên cứu (Nissenbaum, Kaller, Nickell) bảo vệ ông. [NYSL](https://nysl.nysed.gov/collections/stnick/), [MCNY](https://www.mcny.org/story/clement-clarke-moore-and-santa-city)
- Phía Livingston: gia đình ông (mất 1828) khẳng định từ đầu thế kỷ 20, và Don Foster phân tích văn phong ủng hộ; nhưng không có ghi chép nào cho thấy ông từng nhận, và không có bằng chứng vật chất. [NYSL](https://nysl.nysed.gov/collections/stnick/), [Columbia](https://magazine.columbia.edu/article/story-behind-most-famous-christmas-poem-all)
- Một số nguồn ngày nay nghiêng về Livingston. [Poetry Foundation](https://www.poetryfoundation.org/poets/clement-clarke-moore)

*Theo Kinh Thánh hoặc theo truyền thống:* không có; ẩn mục.

---

### 3.4 `caga-tio` — Caga Tió (DG †, Mốc "thế kỷ 19" xác nhận, Dấu TRANH CÃI)

**Mốc.** Bản ghi sớm nhất tìm được: 1886. Càntut (kho cançoner Catalan) nói: "La primera referència l'hem trobat recollida l'any 1886 dintre ‘Ethologia de Blanes’" của Josep Cortils i Vieta, trích bài "Tió, tió, c… turró, Pe'l naixement de Nostre Senyó" kèm câu "la acció de colpejar lo tió col-locat en la llar". Tôi chưa mở được bản gốc 1886 (chỉ có hồ sơ thư mục PCCD xác nhận sách tồn tại, in 1886). Fornés (qua Betevé, 2020): bài hát "són de fa 150 anys" (≈1870). Hai nguồn khớp với "thế kỷ 19"; nên ghi "ít nhất từ 1886" nếu cần số. Một bài khác (Josep Busquets, Erol, raco.cat) có vẻ nói bài hát lan ra trong thế kỷ 18–19, nhưng trang bị chặn, ○ không dùng.

**Mệnh đề và nguồn**

| Mệnh đề | Trạng thái | Nguồn ✔ và cụm chứng minh |
|---|---|---|
| Tục: khúc củi được cho ăn trước đó vài ngày, trẻ đập bằng gậy theo bài hát để nó "ỉa" kẹo và quà | vững | https://visitmuseum.gencat.cat/ca/museu/museu-terra/objecte/el-tio-de-nadal : "Definim el tió com un tronc gros que per Nadal, i a força de bastonades de les criatures, fingim que arriba a cagar dolços i altres regals. Dies abans, la canalla li porta menjar per alimentar-lo." https://www.enciclopedia.cat/gran-enciclopedia-catalana/tio : "la tradició encara és viva" |
| Phủ chăn, đập vào đêm 24/12, rồi nhấc chăn thấy quà | vững | https://www.npr.org/sections/thesalt/2017/12/22/572569325/caga-ti-a-catalan-log-that-poops-nougats-at-christmas : "After feeding him for weeks, on December 24, a blanket was placed on the non-face end of Tió. Then the singing, and the beating, would commence." |
| Gốc gác mờ | vững | NPR: "The origins of both Caga Tió and turrón are hazy"; hỏi vì sao bắt nó "ỉa": "No one knows," Yánez said. |
| Gốc cổ, ngoại giáo | tranh cãi | Phía cổ: NPR, tờ rơi của phòng Văn hóa Dân gian Barcelona "described the origins of Caga Tió as a pagan tradition celebrating the Winter Solstice"; Betevé (Fornés): "El tió prové de cultes ancestrals"; https://cultura.gencat.cat/ca/detall/Noticies/N_Nadala2025 : "totes comparteixen un origen simbòlic comú" (Yule log, Bûche de Noël…). Phía thận trọng: Fornés "el costum de fer-lo cagar és més modern"; NPR: "At some point – and no one knows exactly when". |
| Bài hát đập Tió ghi từ cuối thế kỷ 19 | vững (một nguồn thứ cấp trích bản gốc, một nguồn tin) | https://cantut.cat/canconer/cancons/item/720-tio-tio : "La primera referència l'hem trobat recollida l'any 1886 dintre ‘Ethologia de Blanes’". https://beteve.cat/cultura/llibre-tio-nadal-repassa-origens-ancestrals-tradicio/ : "Les cançons que s’han trobat vinculades a aquest ritual són de fa 150 anys"; "només aquí és on se li dona bastonades" (đập bằng gậy chỉ thấy ở xứ Catalan). Hồ sơ sách: https://pccd.dites.cat/obra/Cortils_i_Vieta%2C_Josep_%281886%29%3A_Etholog%C3%ADa_de_Bl%C3%A1nes ("Any de publicació: 1886"). |
| Mặt và mũ barretina của Tió là hiện đại | vững | Betevé: "Originàriament no tenia ni barretina ni cara … cap als anys 70 es va implantar i sobretot es va fer per vendre". Gencat Cultura: "inicialment el tió era un simple tronc buit, sense cara". |
| Tên đúng là "tió"; "cagatió" là từ nguyên dân gian | tranh cãi nhẹ (một nhà nhân học) | Betevé: "El nom correcte és tió, i no cagatió, una forma sorgida de l’etimologia popular." Tên chương "Caga Tió" vẫn đúng với cách gọi phổ biến (NPR). |
| "Tàn dư tế lễ mặt trời cổ" (Joan Amades) | thiếu nguồn | Chỉ thấy trong kết quả tìm kiếm, chưa mở trang (○). Nguồn đã mở nói tục ngoại giáo mừng đông chí (NPR) và "cultes ancestrals" (Betevé), không nói "mặt trời" hay Amades. |

**Dòng bible cần sửa:** mục 2, điểm 4.

### Sổ tay `caga-tio`

**Sổ tay: thẻ 2–3 dòng**

> Ở Catalonia, trẻ con cho khúc củi Tió de Nadal "ăn", phủ chăn rồi đập bằng gậy, vừa hát vừa bảo nó "ỉa" ra kẹo và quà. Gốc gác còn mờ: có người cho là nghi lễ cổ, nhưng bài hát đập Tió chỉ thấy ghi từ cuối thế kỷ 19.

**Sổ tay: bản đầy đủ**

*Sự thật*
- Tió là khúc củi to. Trước Giáng Sinh vài ngày trẻ con mang đồ ăn cho nó; đến đêm 24/12 người ta phủ chăn, cho trẻ đập bằng gậy theo bài hát, rồi nhấc chăn lên: dưới đó có kẹo và quà nhỏ. [Gencat](https://visitmuseum.gencat.cat/ca/museu/museu-terra/objecte/el-tio-de-nadal), [NPR](https://www.npr.org/sections/thesalt/2017/12/22/572569325/caga-ti-a-catalan-log-that-poops-nougats-at-christmas)
- Bài hát đập Tió sớm nhất mà nhóm Càntut tìm thấy được in năm 1886, trong sách về làng Blanes của Josep Cortils i Vieta. [Càntut](https://cantut.cat/canconer/cancons/item/720-tio-tio), [PCCD](https://pccd.dites.cat/obra/Cortils_i_Vieta%2C_Josep_%281886%29%3A_Etholog%C3%ADa_de_Bl%C3%A1nes)
- Tió ngày xưa là khúc củi trơn, không mặt; khuôn mặt và chiếc mũ barretina phổ biến từ khoảng thập niên 1970. [Betevé](https://beteve.cat/cultura/llibre-tio-nadal-repassa-origens-ancestrals-tradicio/), [Gencat Cultura](https://cultura.gencat.cat/ca/detall/Noticies/N_Nadala2025)

*Truyền thuyết ("người ta kể rằng")*
- Không có mục riêng. (Câu chuyện "Tió từ nghi lễ cổ" nằm ở phần tranh cãi.)

*Tranh cãi: Tió cổ đến đâu?*
- Phía cổ: tờ rơi của phòng Văn hóa Dân gian Barcelona (qua NPR) mô tả Tió là tục ngoại giáo mừng đông chí, và nhà nhân học Josep Fornés nói khúc củi có gốc từ các nghi lễ cổ; Bộ Văn hóa Catalonia xếp nó cùng họ với tục khúc củi Giáng Sinh ở nhiều nơi châu Âu. [NPR](https://www.npr.org/sections/thesalt/2017/12/22/572569325/caga-ti-a-catalan-log-that-poops-nougats-at-christmas), [Betevé](https://beteve.cat/cultura/llibre-tio-nadal-repassa-origens-ancestrals-tradicio/), [Gencat Cultura](https://cultura.gencat.cat/ca/detall/Noticies/N_Nadala2025)
- Phía thận trọng: cũng Fornés nói tục bắt nó "ỉa" và đập bằng gậy hiện đại hơn, bài hát chỉ thấy ghi từ khoảng 150 năm trước (tính đến 2020); NPR: không ai biết vì sao nó phải "ỉa" và tục tiến hóa lúc nào. [Betevé](https://beteve.cat/cultura/llibre-tio-nadal-repassa-origens-ancestrals-tradicio/), [NPR](https://www.npr.org/sections/thesalt/2017/12/22/572569325/caga-ti-a-catalan-log-that-poops-nougats-at-christmas)

*Theo Kinh Thánh hoặc theo truyền thống:* không có; ẩn mục (đừng gắn Tió với hang đá Catalan: chưa có nguồn).

---

### 3.5 `dickens` — Dickens 1843 (DG, Mốc 1843 đúng, Dấu SỰ THẬT)

**Mệnh đề và nguồn**

| Mệnh đề | Trạng thái | Nguồn ✔ và cụm chứng minh |
|---|---|---|
| "A Christmas Carol" ra ngày 19/12/1843 (Chapman and Hall); 6.000 bản đầu bán hết trong vài ngày | vững | https://www.britishlibrary.cn/en/works/charles-dickenss-christmas-carol/ (trang British Library; bản bl.uk/works không tải được): "published by Chapman and Hall on 19 December 1843, was an immediate success and the initial print run of 6,000 copies sold out within a matter of days." |
| Dickens không phát minh Giáng Sinh; ông viết đúng lúc nhiều thứ mới xuất hiện | vững (kết luận từ hai nguồn; không nguồn nào dùng nguyên câu "không phát minh Giáng Sinh") | https://www.birmingham.ac.uk/research/perspective/was-christmas-invented-in-birmingham : "There were several Victorian innovations around Christmas. Christmas cards were first sent in the 1840s; Prince Albert brought with him the German tradition of the Christmas tree; Christmas crackers emerged … Dickens did not invent all of this, but he was able to create a story that captured the spirit of the time"; phim "plays fast and loose with the facts". https://www.vam.ac.uk/articles/the-first-christmas-card : "the 1840s was a period of change"; "authors responded to the trend: Charles Dickens wrote Christmas themed stories … and published A Christmas Carol in 1843". British Library: Dickens đã viết về Giáng Sinh trước đó trong Pickwick Papers (1837). |
| Cây thông do Hoàng thân Albert mang vào Anh | nói quá | https://www.rct.uk/collection/stories/a-royal-christmas/the-christmas-tree : "introduced to Britain in the late 18th century by Queen Charlotte"; "popularised by Queen Victoria and Prince Albert in the 19th century" (hình trên Illustrated London News 1848). Birmingham ("Prince Albert brought with him the German tradition of the Christmas tree") và V&A ("Prince Albert introducing various German Christmas traditions to the British public, including the decorated Christmas tree") viết gọn như vậy; Royal Collection chính xác hơn, nên đừng nói Albert "đưa vào". Năm của hình ILN: https://www.rct.uk/articles/royal-christmas-trees : "Their love for Christmas trees did much to popularise the tradition. In 1848, The Illustrated London News printed a picture of the royal family around a Christmas tree." (Năm 1848, The Illustrated London News in tranh gia đình hoàng gia đứng quanh cây thông; trang không nêu ngày phát hành chính xác của số báo). |
| Cây Giáng Sinh trang trí đầu tiên được biết ở Anh: Hoàng hậu Charlotte dựng một cây thủy tùng (yew) trang trí tại Queen's Lodge, Windsor, đêm 24/12/1800 | vững | https://www.rct.uk/articles/royal-christmas-trees : "On Christmas Eve 1800, Queen Charlotte hosted a festive party for children of all the principal families in Windsor at the Queen’s Lodge. At the centre of the celebration stood a decorated yew tree." (đêm Giáng Sinh 1800, Charlotte mở tiệc lễ hội cho trẻ em của các gia đình danh giá ở Windsor tại Queen's Lodge; ở giữa buổi lễ là một cây thủy tùng được trang trí). https://www.english-heritage.org.uk/christmas/victorian-christmas-traditions : "Charlotte is credited with bringing decorated evergreen trees to England when she introduced their first Christmas tree at Queen's Lodge, Windsor, in 1800." (Charlotte được coi là người đem cây thường xanh trang trí vào Anh với cây Giáng Sinh đầu tiên của họ ở Queen's Lodge, Windsor, năm 1800). https://www.historytoday.com/archive/history-matters/first-christmas-tree : "However, the honour of establishing this tradition in the United Kingdom rightfully belongs to ‘good Queen Charlotte’, the German wife of George III, who set up the first known English tree at Queen’s Lodge, Windsor, in December, 1800." (cây "first known English tree" — cây đầu tiên được biết ở Anh — tại Queen's Lodge, Windsor, tháng 12/1800; bài này kể bữa tiệc trẻ em vào tối ngày Giáng Sinh). Trang RCT đang dùng ở hàng trên (rct.uk/collection/stories/a-royal-christmas/the-christmas-tree) chỉ nói "late 18th century", không nêu năm. |
| Thiệp Giáng Sinh thương mại đầu tiên, 1843: Henry Cole đặt John Callcott Horsley; in 1.000 tấm; bán 1 shilling | vững | https://www.postalmuseum.org/collections/first-christmas-card/ : "Sir Henry Cole … commissioned the first commercial Christmas card in 1843"; "The initial print run was for 1000 cards. Designed by painter John Callcott Horsley"; "sold the rest for one shilling each". https://www.vam.ac.uk/articles/the-first-christmas-card : "Cole then commissioned a printer … printing a thousand copies"; "offered for sale at a shilling a piece"; nhật ký Cole 17/12/1843: "In the Evg Horsley came & brought his design for Christmas Cards". |
| Thiệp bán chạy hay thất bại | tranh cãi | V&A: "the venture was judged a commercial flop"; Postal Museum: "this did not stop people buying the cards and more were printed to satisfy demand". |
| Thiệp "bán đại trà" | sai | Nguồn nói "commercial", in thạch bản rồi tô màu tay (Postal Museum: "printed lithographically and then hand-coloured"), 1.000 tấm, giá "expensive at the time" (V&A). |

**Thứ tự:** bản ghi sớm nhất được biết về hôn dưới tầm gửi là tác phẩm Anh năm 1784 (m0b-act-1 §7), trước cây thông của Charlotte (đêm 24/12/1800).

**Dòng bible cần sửa:** mục 2, điểm 5. Câu an toàn đã sửa: "Dickens không phát minh Giáng Sinh; ông viết một cuốn sách đúng lúc người ta đang làm mới lễ này. Năm 1843 cũng có tấm thiệp Giáng Sinh thương mại đầu tiên, in 1.000 tấm."

### Sổ tay `dickens`

**Sổ tay: thẻ 2–3 dòng**

> Dickens không phát minh ra Giáng Sinh. "A Christmas Carol" ra ngày 19/12/1843, đúng lúc nhiều thứ được làm mới; cùng năm, Henry Cole đặt họa sĩ Horsley vẽ tấm thiệp Giáng Sinh thương mại đầu tiên, in 1.000 tấm, bán 1 shilling.

**Sổ tay: bản đầy đủ**

*Sự thật*
- "A Christmas Carol" do Chapman and Hall xuất bản ngày 19/12/1843; 6.000 bản đầu bán hết trong vài ngày. [British Library](https://www.britishlibrary.cn/en/works/charles-dickenss-christmas-carol/)
- Thập niên 1840 có nhiều đổi mới quanh Giáng Sinh (thiệp, cây thông được hoàng gia làm phổ biến, pháo giấy, tặng quà trẻ em); Dickens không phát minh tất cả những thứ đó, mà viết một câu chuyện bắt được tinh thần thời ấy. [Birmingham](https://www.birmingham.ac.uk/research/perspective/was-christmas-invented-in-birmingham), [V&A](https://www.vam.ac.uk/articles/the-first-christmas-card)
- Cây thông vào Anh từ cuối thế kỷ 18 qua Hoàng hậu Charlotte; Nữ hoàng Victoria và Hoàng thân Albert làm nó phổ biến (hình in trên báo năm 1848). [Royal Collection Trust](https://www.rct.uk/collection/stories/a-royal-christmas/the-christmas-tree)
- Năm 1843 Henry Cole đặt John Callcott Horsley vẽ tấm thiệp Giáng Sinh thương mại đầu tiên; in 1.000 tấm, bán 1 shilling mỗi tấm. [Postal Museum](https://www.postalmuseum.org/collections/first-christmas-card/), [V&A](https://www.vam.ac.uk/articles/the-first-christmas-card)

*Truyền thuyết ("người ta kể rằng")*
- Người ta hay gọi Dickens là "người đã phát minh ra Giáng Sinh", nhưng đó là biệt danh, không phải sự thật lịch sử. [Birmingham](https://www.birmingham.ac.uk/research/perspective/was-christmas-invented-in-birmingham)

*Tranh cãi: tấm thiệp 1843 thành công hay không?*
- V&A: việc làm ăn bị coi là thất bại thương mại vì giá đắt. Postal Museum: người ta vẫn mua và phải in thêm. [V&A](https://www.vam.ac.uk/articles/the-first-christmas-card), [Postal Museum](https://www.postalmuseum.org/collections/first-christmas-card/)

*Theo Kinh Thánh hoặc theo truyền thống:* không có; ẩn mục.

**Ghi chú cho người viết:** thiệp 1843 vẽ trẻ em uống rượu và gây tranh luận (Postal Museum); không cần đưa vào.

---

### 3.6 `brooms` — Đêm Giáng Sinh nguy hiểm (DG †, "chưa rõ năm" giữ được, Dấu SỰ THẬT chỉ cho phần đêm nguy hiểm)

**Nhãn và Mốc.** DG † giữ. "Chưa rõ năm" giữ được: các nguồn Na Uy mô tả tín ngưỡng, không ghi năm của tục. Có một bản ghi có năm gần nhất: lời khai tại tòa án xử phù thủy ở Vardø tháng 1/1663 nói về đêm 24/12/1661 (mục dưới). Nếu bible muốn đặt brooms lên trục năm thì có thể dùng "1663", nhưng đó là lời khai bị ép về một buổi họp phù thủy chứ không phải bản ghi về tục lệ. Khuyến nghị giữ "chưa rõ năm", chỉ dùng 1663 như ví dụ trong Sổ tay.

**Mệnh đề và nguồn**

| Mệnh đề | Trạng thái | Nguồn ✔ và cụm chứng minh |
|---|---|---|
| Đêm Giáng Sinh (đêm 24 rạng 25/12) theo tín ngưỡng dân gian Na Uy là một trong những đêm nguy hiểm nhất năm; gần như mọi sinh vật siêu nhiên ra ngoài | vững (là tín ngưỡng, không phải sự kiện) | https://snl.no/julenatt (Ina Louise Stovner, Đại học Oslo): "Julenatt er natten mellom julaften og juledag. Ifølge folketroen var dette en av årets farligste netter. Nesten alle overnaturlige vesener var på ferde denne natten". https://norskfolkemuseum.no/den-skumle-jula (Audun Kjus): "Jula var ganske enkelt kjent som en farlig tid"; "julaften var den skumle sesongens klimaks". https://www.nrk.no/kultur/heksenes-julegilde-1.6945584 (Rune Blix Hagen): "I følge tradisjonen er det natten mellom julaften og første juledag aller mest fylt med magi, trollskap og mystikk." |
| Các sinh vật: Åsgårdsreia (đoàn săn hoang), julebukk/julegeit (dê Yule), người chết trở về; troll, hulder, draug, Quỷ, Lussi, Stallù của người Sámi | vững là nội dung nguồn | SNL julenatt: "åsgårdsreia", "julebukken eller julegeita", "de døde vendte tilbake". Norsk Folkemuseum: "troll, hulder, draug og Djevelen selv", "Åsgardsreia", "Lussi", "den onde Stallù". |
| Cách phòng vệ: vẽ dấu thập bằng nhựa than, than, phấn hoặc máu lên cửa và đồ vật; đặt đồ thép (liềm, lưỡi hái) ở chỗ quan trọng; đóng một cây chổi bách xù ("briskefut") canh cửa; ngủ chung trên rơm; thức canh đêm | vững là nội dung nguồn | https://snl.no/julenatt : "å tegne kors over alle dører med tjære, kull, kritt eller blod"; "For å vokte inngangen kunne man også sette opp en «briskefut», det vil si en fastspikret sopelime av einer"; "var det mange steder vanlig helt fram til midten av 1800-tallet å sove sammen i halm på stuegulvet". |
| Lý do đêm bị coi là đáng sợ | tranh cãi / nhận định | Norsk Folkemuseum: là tàn dư của "middelaldersk, katolsk kalenderteknologi" tạo tương phản trước ngày vui ("De skumle historiene skulle altså bygge opp under julens glade budskap!"), cũng có thể chỉ là để thích thú như phim kinh dị ("kan vi nok også anta"). NRK/Hagen: thời xét xử phù thủy thế kỷ 16–17 "ortodoksiens tidsalder" làm người ta "farliggjort" các lễ hội cũ. |
| Phù thủy đến bằng chổi đêm 24/12/1661 (lời khai bị ép tại tòa) | truyền thuyết, có ghi chép năm | https://doi.org/10.7557/15.3847 (Rune Blix Hagen, Tromsøflaket nr. 19, 2002, Thư viện Đại học Tromsø): "Under et rettsforhør av Sølvi Nilsdatter i Vardø i slutten av januar 1663 … Julaften 1661 ble det holdt en gigantisk heksesabbat på Dovrefjell … Flere av de heksene som kom nordfra på sine hurtiggående sopelimer". NRK Hagen: lời khai "presset fram" bằng tra tấn pháp lý, và "Meningen med historiene var altså ikke å underholde". https://snl.no/heks (Hagen): khái niệm phù thủy thời đầu hiện đại gồm "nattlig luftferd på sopelimer, geitebukker eller andre framkomstmidler". |
| Phù thủy và troll cưỡi sói, chổi hoặc xẻng đến họp ở đồi trong đêm Giáng Sinh | truyền thuyết, **của Thụy Điển** | Clement A. Miles, Christmas in Ritual and Tradition (1912), ch. IX, tr. 235: "In Sweden the Trolls are believed to celebrate Christmas Eve … On the heaths witches and little Trolls ride, one on a wolf, another on a broom or a shovel", chú thích 22: "Thorpe, ii. 89" (Northern Mythology, 1852). Đọc qua https://archive.org/download/christmasinritua19098gut/19098.txt (bản Project Gutenberg). Trang bible dẫn https://www.scandinavianchristmastraditions.com/christmas-eve.html chép lại đoạn này nhưng bỏ "In Sweden" (viết "In the Scandinavian countries … The Trolls"). |
| Người Na Uy giấu chổi đêm Giáng Sinh | thiếu nguồn | Nguồn có nói: https://news.northeastern.edu/2018/12/20/these-holiday-traditions-will-surprise-you/ (tin tổng hợp): "Since legend asserts that witches and evil spirits come out on Christmas eve, Norwegians will hide all the brooms and mops in the house"; https://nordeniskolen.org/media/3jzjmf2x/7s.pdf (kịch audio học đường Norden i skolen): "Gjem kosten er en gammel norsk juletradisjon. Det er ikke alle nordmenn, som fortsatt praktiserer den."; blog niftybuckles.wordpress.com (○, chỉ thấy đoạn trích tìm kiếm, không dùng). Không nguồn nào nêu bản ghi, năm, người thu thập. Nguồn ngược chiều: https://www.tronderdebatt.no/tronderhistorie-jul-i-trondelag/o/5-122-14474 (sử gia Terje Bratberg, bài đi kèm podcast Trønderhistorie, 26/12/2020, không dẫn nguồn): "Alle koster, raker og sopelimer ble omhyggelig plassert utenfor dørene så trollkjerringene ikke kom inn i huset for å kreve dem." (để ngoài cửa, không phải giấu); cùng bài: "I folkesagnene gikk disse rundt på julenatten og lette opp slike så de kunne ri på dem sammen med Reia til heksesabbat." (trong truyện dân gian, phù thủy đi tìm chổi để cưỡi); SNL: chổi bách xù đóng ở cửa để canh. |

**Dòng bible cần sửa:** mục 2, điểm 6. Thêm cho người viết:

- SNL và Norsk Folkemuseum có nhắc "Jesusbarnet", máng cỏ và động vật cầu nguyện đêm Giáng Sinh; cột cuối của bảng chương này là "không". Nếu muốn dùng các chi tiết đó thì phải xem lại cột đó với reviewer. Khuyến nghị bỏ.
- Hình mini game (bóng rọi đèn) có thể lấy từ danh sách sinh vật ở trên; "nguồn nói nhiều sinh vật" của bible có thể mạnh hơn: SNL viết "Nesten alle" (gần như tất cả).

### Sổ tay `brooms`

**Sổ tay: thẻ 2–3 dòng**

> Theo tín ngưỡng dân gian Na Uy, đêm Giáng Sinh là một trong những đêm nguy hiểm nhất năm: gần như mọi sinh vật siêu nhiên đều ra ngoài. Người ta vẽ dấu thập lên cửa, đặt đồ thép khắp trang trại và canh thức suốt đêm để bảo vệ nhà.

**Sổ tay: bản đầy đủ**

*Sự thật*
- Bách khoa toàn thư quốc gia Na Uy viết: theo tín ngưỡng dân gian, đêm giữa 24 và 25/12 là một trong những đêm nguy hiểm nhất năm, gần như mọi sinh vật siêu nhiên đều đi lại, đáng sợ nhất là đoàn săn hoang Åsgårdsreia, và còn có con dê Yule (julebukk). [SNL](https://snl.no/julenatt)
- Người ta tự bảo vệ bằng dấu thập vẽ lên cửa và đồ vật, đồ thép đặt ở chỗ quan trọng, một cây chổi bách xù (briskefut) đóng chặt canh cửa, và nhiều nơi ngủ chung trên rơm đến giữa thế kỷ 19. [SNL](https://snl.no/julenatt)
- Bảo tàng Dân gian Na Uy nói Giáng Sinh vốn được biết là mùa nguy hiểm, và đêm 24/12 là đỉnh điểm của mùa kể chuyện rùng rợn: troll, hulder, draug, Quỷ, Åsgårdsreia. Ông giải thích đó là cách thời Trung Cổ làm lễ vui hơn bằng tương phản, và cho rằng cũng có thể chỉ để thích thú như phim kinh dị. [Norsk Folkemuseum](https://norskfolkemuseum.no/den-skumle-jula)

*Truyền thuyết ("người ta kể rằng")*
- Người ta kể rằng phù thủy dùng chổi để bay đến các cuộc họp đêm. Một lời khai ở Vardø năm 1663 (có dấu hiệu bị ép) kể về buổi họp phù thủy trên Dovrefjell vào đêm 24/12/1661, nơi nhiều phù thủy "đến bằng chổi". [Hagen, UiT](https://doi.org/10.7557/15.3847), [NRK](https://www.nrk.no/kultur/heksenes-julegilde-1.6945584)
- Ở Thụy Điển có tin rằng phù thủy và troll cưỡi sói, chổi hoặc xẻng tới đồi họp trong đêm Giáng Sinh. [Miles 1912](https://archive.org/download/christmasinritua19098gut/19098.txt)

*Tranh cãi / chưa kiểm chứng*
- Một số bài viết nói người Na Uy giấu chổi đêm Giáng Sinh để phù thủy không lấy được. Chúng tôi chưa tìm thấy nguồn dân tộc học hay bảo tàng xác nhận, và một sử gia lại kể chổi được để ngoài cửa. Vì vậy đây không được tính là sự thật. [Northeastern](https://news.northeastern.edu/2018/12/20/these-holiday-traditions-will-surprise-you/), [Bratberg](https://www.tronderdebatt.no/tronderhistorie-jul-i-trondelag/o/5-122-14474)  *(đoạn này là tùy chọn; nếu bible muốn Sổ tay chỉ có điều đã kiểm chứng thì bỏ cả đoạn và để dòng chổi chỉ ở lời Cúc Cu.)*

*Theo Kinh Thánh hoặc theo truyền thống:* không có; ẩn mục.

---

## 4. Chưa xác minh hoặc không dùng

- **Þjóðminjasafn Íslands:** tìm các trang của bảo tàng nhưng không có trang nào nêu bản ghi sớm nhất của Mèo Yule. Bài Vísindavefur chỉ trích "heimildamönnum þjóðháttadeildar" về nghĩa của thành ngữ "fara í jólaköttinn", không có năm. Thay bằng Árnastofnun, bản quét Jón Árnason và Landsbókasafn. askasleikir.is là trang dịch vụ thương mại, không dùng.
- **Bản gốc 1886 của Cortils i Vieta** (tió): chỉ qua Càntut. Bài Busquets (raco.cat/Erol/article/view/172790) và Soler Amigó: ○ (trang bị Cloudflare chặn, bản trích tóm tắt lệch nội dung).
- **Joan Amades và "tế lễ mặt trời"**: ○ (escorialvic.org, farelleditors.cat chưa mở). Không dùng.
- **William Dunbar (~1500) và áo mới:** chỉ qua bbl.is; chưa mở bản thơ.
- **Britannica về tác giả bài thơ Moore:** trang chỉ hiện phần đầu; không dùng để khẳng định Livingston.
- **Euro Weekly News** và blog niftybuckles về giấu chổi: chỉ thấy đoạn trích tìm kiếm (○), không dùng.
- **Trích Bratberg "En fyr fra USA spurte meg om det er sant at nordmenn gjemmer kostene sine":** chỉ thấy trong đoạn trích tìm kiếm, không có trong trang đã mở (○). Câu về chổi để ngoài cửa thì có trong trang.
- **Tên bài của Jón Samsonarson (1979)** và số trang bản in: chưa lấy được; chỉ có trang Tímarit.is.
- Bản bl.uk/works của British Library trả về trang trống; dùng bản britishlibrary.cn (cùng nội dung, nhãn British Library).
- **Bảo vệ OCR:** các trích dẫn Jón Árnason lấy từ OCR của Internet Archive; số trang đối chiếu với tiêu đề trang trong OCR (570 ở tập II, 220 ở tập I). Cần reviewer nhìn bản quét một lần nếu muốn trích nguyên văn lên màn hình.

## 5. Cách kiểm

Mở trang bằng công cụ đọc web; với bản quét sách, tải bản OCR từ Internet Archive bằng `curl` rồi tìm chuỗi (tập I và II của Jón Árnason, Miles 1912). Mọi cụm trích ở trên đã thấy trong văn bản đã mở. Không sửa file nào khác ngoài file này.
