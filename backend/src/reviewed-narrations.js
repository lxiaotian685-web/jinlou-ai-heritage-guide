import { reviewedSpotContent } from './reviewed-spots.js';

const spotNames = {
  'nanshan-hall': '南山祠',
  zhifangdi: '职方第',
  duizhao: '对朝',
  jinlou: '金楼',
  shouqingwu: '守清屋',
  'boshao-clinic': '伯韶医馆',
  nilou: '泥楼',
  'wokear-residence': '镬耳民居',
  'wokear-house': '镬耳大屋',
  'yiyu-school': '亦渔遗塾',
  'components-exhibit': '民居构件展示',
  'twenty-four-odes': '二十四咏',
  'baoyue-pavilion': '抱月亭',
  'diequ-pavilion': '叠趣亭',
  garden: '后花园',
};

// 粤语、英语、日语讲解均为已审核普通话讲解词的机器翻译试听稿，
// 事实仍以中文原稿为准，发音与用词待景区人工审核。
const translations = {
  yue: {
    languageLabel: '粤语',
    records: {
      'nanshan-hall': '欢迎嚟到南山祠。南山祠係碧江金楼古建筑群入面嘅祠堂建筑之一，体现古村宅第、祠堂、书塾同园林互相结合嘅空间特色。现有公开资料仲未确认佢嘅具体始建年代同祭祀对象。',
      zhifangdi: '欢迎嚟到职方第。职方第係清代兵部职方员外郎苏丕文嘅宅第，建于清嘉庆、道光年间。建筑原本有五进，现存四进，过亭、砖石牌坊同题刻係重点睇点，係晚清珠三角广府民居建筑嘅代表。',
      duizhao: '欢迎嚟到对朝屋。对朝屋位于碧江金楼景区入面，已经作为清代古建筑列入顺德区第四次全国文物普查新发现不可移动文物名录。具体用途、格局同展陈说明仲要等景区审核资料补充。',
      jinlou: '欢迎嚟到金楼。金楼原名赋鹤楼，係苏丕文起嘅藏书楼。楼入面保存花罩、帘架、藻井同天花等木雕构件，运用浮雕、线刻、镂雕同玻璃镶嵌等技法，并加上泥金同贴金装饰。',
      shouqingwu: '欢迎嚟到守清屋。守清屋位于碧江金楼景区入面，係同顺德自梳女历史有关嘅清代古建筑，现有空间曾经用作女性独立生活主题展览。建筑细部、人物故事同展览开放情况，以景区现场说明为准。',
      'boshao-clinic': '欢迎嚟到伯韶医馆。伯韶医馆係景区入面嘅清代古建筑，展陈以苏伯韶嘅生平同行医经历为线索，并复原睇诊、会客同诊疗空间。现有公开资料显示，佢由前园、天井、廊道、中厅同大座等空间组成。',
      nilou: '欢迎嚟到泥楼。泥楼始建于明代，係两层三间两廊式民居。墙身用泥、沙等材料夯筑，同时有隔热效果；20世纪初改建嘅两廊加入拱券同罗马柱等元素，係顺德少见嘅高层干打垒建筑。',
      'wokear-residence': '欢迎嚟到镬耳民居。镬耳民居呢个点位用嚟观察岭南传统民居嘅镬耳山墙、青砖墙面同院落关系。呢个名嚟自景区现场分布牌，具体建筑年代、原住户同修缮沿革仲要等景区资料确认。',
      'wokear-house': '欢迎嚟到镬耳大屋。镬耳大屋对应景区入面嘅苏氏镬耳屋，係顺德区第四次全国文物普查记录嘅清代古建筑。佢嘅具体格局、原住户同建筑演变，仲要等景区审核资料补充。',
      'yiyu-school': '欢迎嚟到亦渔遗塾。亦渔遗塾係清代苏氏三兴堂嘅家塾，规模比一般书塾大。建筑由三间两廊式房屋同明字屋组成，隔扇木门雕有花草、瑞兽图案，体现碧江古村嘅耕读传统。',
      'components-exhibit': '欢迎嚟到民居构件展示。民居构件展示点集中帮游客辨认传统建筑入面嘅门窗、隔扇、梁架、砖雕同木雕等构件。具体构件名称、年代、来源同修缮资料，仍然要以景区展签同审核资料为准。',
      'twenty-four-odes': '欢迎嚟到二十四咏。《碧江二十四咏》源自清代文人苏鹤描绘碧江人文同自然景观嘅二十四首诗。景区以诗作为线索制作铜壁雕，呈现旧时碧江嘅水乡生活同历史景观。',
      'baoyue-pavilion': '欢迎嚟到抱月亭。抱月亭位于景区园林区域，係游人观赏池水、回廊同园林层次嘅亭阁点位。佢嘅建造年代、名称沿革同原有用途，目前未有可靠公开资料，要等景区说明确认。',
      'diequ-pavilion': '欢迎嚟到叠趣亭。叠趣亭位于景区园林区域，个名见于景区相关游览资料。游客可以喺度观察亭、廊、水体同植物构成嘅园林空间；具体年代同营造故事仲要等景区审核。',
      garden: '欢迎嚟到后花园。后花园保留池水、回廊、亭阁同古树等园林要素，并陈列《碧江二十四咏》铜壁雕。公开资料显示，现存园林係修复后嘅部分范围，具体开放区域以景区现场安排为准。',
    },
  },
  en: {
    languageLabel: 'English',
    records: {
      'nanshan-hall': 'Welcome to Nanshan Ancestral Hall. Nanshan Ancestral Hall is one of the ancestral halls in the Bijiang Jinlou historic building complex. It reflects how the old village combined residences, ancestral halls, schools and gardens within one spatial layout. Available public sources have not yet confirmed the exact year it was first built or the ancestors it was dedicated to.',
      zhifangdi: 'Welcome to Zhifangdi. Zhifangdi was the residence of Su Piwen, a Qing-dynasty Zhifang Vice Director in the Ministry of War, and was built during the Jiaqing and Daoguang reigns. The compound originally had five courtyards, and four remain today. The passage pavilion, the brick-and-stone archway and the inscriptions are the highlights. It is a representative example of late-Qing Guangfu dwellings in the Pearl River Delta.',
      duizhao: 'Welcome to Duizhao House. Duizhao House stands inside the Bijiang Jinlou scenic area. It has been registered as a Qing-dynasty historic building in the list of immovable heritage newly recorded during the fourth national cultural relics survey of Shunde District. Its original function, layout and exhibition description still await review by the scenic area.',
      jinlou: 'Welcome to Jinlou. Jinlou, originally named Fuhe Lou, was a library built by Su Piwen. Inside, wooden carvings such as openwork screens, curtain frames, coffered ceilings and ceiling panels have been preserved. They use relief carving, line engraving, pierced carving and glass inlay, and are finished with gold paint and gold leaf.',
      shouqingwu: 'Welcome to Shouqing House. Shouqing House is a Qing-dynasty building in the Bijiang Jinlou scenic area associated with the history of Shunde zishunu, women who chose to remain unmarried. Its rooms have been used for an exhibition on women living independently. Details of the building, individual stories and whether the exhibition is open should follow the on-site notices.',
      'boshao-clinic': 'Welcome to Boshao Clinic. Boshao Clinic is a Qing-dynasty building in the scenic area. Its exhibition follows the life and medical practice of Su Boshao and recreates spaces for consultation, receiving guests and treatment. Public sources describe a layout made up of a front garden, courtyard, corridor, central hall and main hall.',
      nilou: 'Welcome to Nilou. Nilou was first built in the Ming dynasty as a two-storey dwelling with three bays and two side corridors. Its walls are rammed from mud and sand, which also helps insulate the interior. When the corridors were rebuilt in the early 20th century, arches and Roman columns were added, making it a rare tall rammed-earth building in Shunde.',
      'wokear-residence': 'Welcome to Wok-ear Residence. This stop is a place to observe the wok-ear gable walls, grey-brick facades and courtyard layout of traditional Lingnan houses. The name comes from the on-site sign in the scenic area. The building date, original residents and repair history still need to be confirmed by the scenic area.',
      'wokear-house': 'Welcome to Wok-ear Mansion. Wok-ear Mansion corresponds to the Su family wok-ear house in the scenic area, a Qing-dynasty building recorded in the fourth national cultural relics survey of Shunde District. Its exact layout, original residents and later changes still await review by the scenic area.',
      'yiyu-school': 'Welcome to Yiyu Heritage School. Yiyu Heritage School was the family school of the Su clan Sanxing Tang in the Qing dynasty and is larger than a typical private school. It consists of a three-bay, two-corridor building and a ming-style house. Its wooden latticed doors are carved with flowers, plants and auspicious animals, reflecting the old village tradition of farming and scholarship.',
      'components-exhibit': 'Welcome to the Traditional House Components Exhibit. This exhibit helps visitors identify doors and windows, latticed partitions, timber frames, brick carvings and wood carvings. The exact names, dates, sources and repair history of the pieces should follow the scenic area labels and reviewed materials.',
      'twenty-four-odes': 'Welcome to the Twenty-Four Odes. The Twenty-Four Odes of Bijiang come from twenty-four poems by the Qing-dynasty scholar Su He, describing the people and scenery of Bijiang. Using the poems as a thread, the scenic area has created bronze wall reliefs that show the water-town life and historic landscapes of old Bijiang.',
      'baoyue-pavilion': 'Welcome to Baoyue Pavilion. Baoyue Pavilion stands in the garden area of the scenic spot, a stopping point for viewing the pond, corridors and the layered garden. Reliable public sources on its construction date, the history of its name and its original use are still lacking, so these await confirmation from the scenic area.',
      'diequ-pavilion': 'Welcome to Diequ Pavilion. Diequ Pavilion is in the garden area of the scenic spot, and its name appears in the area visitor materials. From here visitors can observe how the pavilion, corridors, water and plants form the garden space. Its exact date and the story of its construction still await review by the scenic area.',
      garden: 'Welcome to the Rear Garden. The Rear Garden preserves garden elements such as the pond, covered corridors, pavilions and old trees, and displays the bronze wall reliefs of the Twenty-Four Odes of Bijiang. Public sources indicate that the present garden is a restored portion of a larger layout, and which areas are open depends on the arrangements on site.',
    },
  },
  ja: {
    languageLabel: '日本語',
    records: {
      'nanshan-hall': '南山祠へようこそ。南山祠は碧江金楼の古建築群に含まれる祠堂のひとつで、古い村の宅第・祠堂・書塾・庭園が一体となった空間構成を伝えています。ただし、創建年代と祭祀の対象については、現在公開されている資料ではまだ確認されていません。',
      zhifangdi: '職方第へようこそ。職方第は、清代に兵部職方員外郎を務めた蘇丕文の邸宅で、嘉慶・道光年間に建てられました。もとは五進の構成でしたが、現在は四進が残っています。通り抜けの亭、磚石の牌坊、題刻が見どころで、清末の珠江デルタにおける広府民居建築の代表例です。',
      duizhao: '対朝屋へようこそ。対朝屋は碧江金楼景区内にあり、清代の古建築として、順徳区における第4回全国文物調査で新たに発見された不可移動文物のリストに登録されています。用途・平面構成・展示説明の詳細は、景区による資料の確認待ちです。',
      jinlou: '金楼へようこそ。金楼はもとの名を賦鶴楼といい、蘇丕文が建てた蔵書楼です。内部には花罩（透かし彫りの建具）、簾架、藻井、天井板などの木彫部材が残り、浮彫・線刻・透彫・ガラス嵌め込みなどの技法に、泥金や金箔による装飾が施されています。',
      shouqingwu: '守清屋へようこそ。守清屋は碧江金楼景区内にある清代の古建築で、順徳の自梳女（結婚せず自立して生きることを選んだ女性たち）の歴史に関わります。現在の空間は、女性の自立した暮らしをテーマにした展示に使われてきました。建物の細部、人物の物語、展示の公開状況は、現地の案内に従ってください。',
      'boshao-clinic': '伯韶医館へようこそ。伯韶医館は景区内にある清代の古建築です。展示は蘇伯韶の生涯と医業をたどるもので、診察・応対・治療の空間が復元されています。公開資料によれば、前園、天井、廊下、中厅、大座などで構成されています。',
      nilou: '泥楼へようこそ。泥楼は明代に建てられた、2階建て・三間・両廊式の民居です。壁は泥や砂を突き固めた版築で、断熱性も備えています。20世紀初頭に廊下が改築され、アーチやローマ式の柱が取り入れられました。順徳では珍しい高層の版築建築です。',
      'wokear-residence': '鑊耳民居へようこそ。この見学ポイントでは、嶺南の伝統民居に見られる鑊耳山牆（鍋の取っ手のような妻壁）、青磚の壁面、中庭の構成を観察できます。名称は景区の現地案内板によるもので、建築年代・もとの居住者・改修の経緯は、景区の資料による確認待ちです。',
      'wokear-house': '鑊耳大屋へようこそ。鑊耳大屋は、景区内にある蘇氏の鑊耳屋にあたります。順徳区の第4回全国文物調査で記録された清代の古建築です。具体的な平面構成、もとの居住者、建築の変遷については、景区による資料の確認待ちです。',
      'yiyu-school': '亦漁遺塾へようこそ。亦漁遺塾は、清代に蘇氏三興堂が設けた家塾で、一般的な書塾より規模が大きいのが特徴です。三間両廊式の建物と明字屋からなり、隔扇の木扉には花草や瑞獣の文様が彫られています。碧江の古い村に受け継がれた耕読（農耕と学問）の伝統を物語っています。',
      'components-exhibit': '民居部材展示へようこそ。ここでは、伝統建築の扉や窓、隔扇、梁組、磚彫り、木彫りなどの部材を見分けられるよう紹介しています。個々の部材の名称・年代・由来・修理の記録については、景区の展示札と確認済み資料に従ってください。',
      'twenty-four-odes': '二十四詠へようこそ。『碧江二十四詠』は、清代の文人・蘇鶴が碧江の人文と自然景観を詠んだ二十四首の詩に由来します。景区は詩を手がかりに銅製の壁彫刻を制作し、かつての碧江の水郷の暮らしと歴史的景観を表しています。',
      'baoyue-pavilion': '抱月亭へようこそ。抱月亭は景区の庭園エリアにあり、池、回廊、庭園の重なりを眺めるための東屋です。建築年代、名称の変遷、もとの用途については信頼できる公開資料がなく、景区の説明による確認待ちです。',
      'diequ-pavilion': '畳趣亭へようこそ。畳趣亭は景区の庭園エリアにあり、その名は景区の観覧資料に見られます。ここでは東屋、回廊、水面、植物が織りなす庭園空間を観察できます。正確な年代や造営の物語は、景区による確認待ちです。',
      garden: '後花園へようこそ。後花園には池、回廊、東屋、古木などの庭園要素が残り、『碧江二十四詠』の銅壁彫刻が展示されています。公開資料によれば、現在の庭園は修復された一部の範囲であり、公開される区域は現地の案内に従ってください。',
    },
  },
};

const extraLanguages = ['yue', 'en', 'ja'];

export const reviewedNarrations = reviewedSpotContent.flatMap((spot) => [
  {
    id: `${spot.id}-zh`,
    spotId: spot.id,
    languageCode: 'zh-CN',
    languageLabel: '普通话',
    transcript: `欢迎来到${spotNames[spot.id]}。${spot.summary}`,
    audioUrl: `/media/narrations/${spot.id}-zh.wav`,
    audioType: 'system-tts-preview',
  },
  ...extraLanguages.map((code) => ({
    id: `${spot.id}-${code}`,
    spotId: spot.id,
    languageCode: code,
    languageLabel: translations[code].languageLabel,
    transcript: translations[code].records[spot.id],
    audioUrl: `/media/narrations/${spot.id}-${code}.wav`,
    audioType: 'system-tts-preview',
  })),
]);
