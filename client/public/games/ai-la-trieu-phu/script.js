const prizes = [
  10, 20, 30, 50, 100, 150, 200, 300, 400, 500, 650, 800, 900, 950, 1000,
];

const fallbackQuestions = [
  {
    text: "Dấu Thánh Giá nhắc chúng ta tuyên xưng mầu nhiệm nào?",
    image: "trinity",
    alt: "Ba Ngôi Thiên Chúa",
    options: ["Một Thiên Chúa Ba Ngôi", "Mười Điều Răn", "Bảy Bí tích", "Các Thánh Tông đồ"],
    correct: 0,
  },
  {
    text: "Kinh Lạy Cha do ai dạy cho chúng ta?",
    image: "prayer",
    alt: "Cầu nguyện",
    options: ["Thánh Phêrô", "Đức Giêsu", "Ông Môsê", "Thánh Phaolô"],
    correct: 1,
  },
  {
    text: "Bí tích nào làm cho chúng ta trở nên con cái Thiên Chúa và gia nhập Hội Thánh?",
    image: "baptism",
    alt: "Bí tích Rửa tội",
    options: ["Thêm Sức", "Rửa Tội", "Hôn Phối", "Xức Dầu Bệnh Nhân"],
    correct: 1,
  },
  {
    text: "Ngày Chúa Nhật, người Công giáo được mời gọi tham dự điều gì cách đặc biệt?",
    image: "mass",
    alt: "Thánh lễ",
    options: ["Thánh lễ", "Một cuộc họp", "Một bữa tiệc", "Một chuyến đi chơi"],
    correct: 0,
  },
  {
    text: "Sách Thánh của người Kitô hữu được gọi là gì?",
    image: "bible",
    alt: "Kinh Thánh",
    options: ["Sách Giáo khoa", "Kinh Thánh", "Sách Lễ", "Từ điển"],
    correct: 1,
  },
  {
    text: "Điều răn trọng nhất Đức Giêsu dạy là yêu mến Thiên Chúa và yêu ai?",
    image: "love",
    alt: "Yêu thương",
    options: ["Bản thân mình mà thôi", "Người thân cận", "Người nổi tiếng", "Người giàu có"],
    correct: 1,
  },
  {
    text: "Trong Thánh lễ, bánh và rượu trở nên gì?",
    image: "eucharist",
    alt: "Thánh Thể",
    options: ["Dấu hiệu may mắn", "Mình và Máu Chúa Kitô", "Món ăn bình thường", "Quà tặng của giáo xứ"],
    correct: 1,
  },
  {
    text: "Đức Maria được Hội Thánh tôn kính đặc biệt với danh xưng nào?",
    image: "mary",
    alt: "Đức Maria",
    options: ["Mẹ Thiên Chúa", "Nữ hoàng Ai Cập", "Ngôn sứ Sinai", "Tông đồ dân ngoại"],
    correct: 0,
  },
  {
    text: "Chúa Thánh Thần thường được nhắc đến như Đấng ban điều gì?",
    image: "spirit",
    alt: "Chúa Thánh Thần",
    options: ["Sức mạnh và ơn thánh", "Sự nổi tiếng", "Kho báu vật chất", "Luật giao thông"],
    correct: 0,
  },
  {
    text: "Mùa Vọng giúp chúng ta chuẩn bị mừng biến cố nào?",
    image: "advent",
    alt: "Mùa Vọng",
    options: ["Chúa Giáng Sinh", "Lễ Tro", "Lễ Lá", "Lễ Các Thánh"],
    correct: 0,
  },
  {
    text: "Mùa Chay kéo dài khoảng bao nhiêu ngày để chuẩn bị mừng Phục Sinh?",
    image: "lent",
    alt: "Mùa Chay",
    options: ["7 ngày", "12 ngày", "40 ngày", "100 ngày"],
    correct: 2,
  },
  {
    text: "Lễ Phục Sinh mừng điều gì?",
    image: "resurrection",
    alt: "Phục Sinh",
    options: ["Chúa Giêsu sống lại", "Ngày khai trường", "Ngày thành lập Rôma", "Ngày mùa gặt"],
    correct: 0,
  },
  {
    text: "Bí tích Hòa Giải giúp chúng ta đón nhận điều gì?",
    image: "reconciliation",
    alt: "Bí tích Hòa Giải",
    options: ["Ơn tha thứ của Thiên Chúa", "Một phần thưởng học tập", "Một chức vụ", "Một chuyến du lịch"],
    correct: 0,
  },
  {
    text: "Mười Điều Răn được Thiên Chúa ban cho dân Israel qua ai?",
    image: "commandments",
    alt: "Mười Điều Răn",
    options: ["Ông Môsê", "Vua Đavít", "Thánh Giuse", "Thánh Luca"],
    correct: 0,
  },
  {
    text: "Sau cùng, đức ái mời gọi chúng ta sống thế nào mỗi ngày?",
    image: "service",
    alt: "Phục vụ",
    options: ["Yêu thương và phục vụ", "Chỉ nghĩ cho mình", "Tránh mọi người", "Luôn muốn thắng người khác"],
    correct: 0,
  },
];

let questions = [];
const classBank = Array.isArray(window.questionBank?.classes) ? window.questionBank.classes : [];
const questionImageKinds = ["trinity", "prayer", "baptism", "mass", "bible", "love", "eucharist", "mary", "spirit", "advent", "lent", "resurrection", "reconciliation", "commandments", "service"];

const letters = ["A", "B", "C", "D"];
const maxTime = 45;
const ringLength = 326.73;
const helperDuration = 30;
const defaultBackground = "./assets/hasagi/MillionareBackground.jpg";
const maxQuestionImageBytes = 5 * 1024 * 1024;

const state = {
  questionIndex: 0,
  selected: null,
  locked: false,
  prize: 0,
  timeLeft: maxTime,
  timerId: null,
  helperTimeLeft: helperDuration,
  helperTimerId: null,
  introFinish: null,
  backgroundObjectUrl: null,
  backgroundImageData: "",
  backgroundSource: "",
  managerNoticeTimer: null,
  selectedQuestionIds: new Set(),
  importedQuestionIds: Array(15).fill(null),
  activeSlotIndex: 0,
  randomSelectionActive: false,
  selectedClassId: null,
  eliminated: new Set(),
  used: {
    fifty: false,
    phone: false,
    audience: false,
    host: false,
  },
};

const els = {
  introScreen: document.getElementById("introScreen"),
  questionScreen: document.getElementById("questionScreen"),
  questionText: document.getElementById("questionText"),
  questionImage: document.getElementById("questionImage"),
  answers: document.getElementById("answers"),
  startButton: document.getElementById("startButton"),
  createQuestionButton: document.getElementById("createQuestionButton"),
  introButton: document.getElementById("introButton"),
  skipIntroButton: document.getElementById("skipIntroButton"),
  fullscreenButton: document.getElementById("fullscreenButton"),
  settingsButton: document.getElementById("settingsButton"),
  endGameButton: document.getElementById("endGameButton"),
  finalButton: document.getElementById("finalButton"),
  nextButton: document.getElementById("nextButton"),
  restartButton: document.getElementById("restartButton"),
  resultPanel: document.getElementById("resultPanel"),
  resultTitle: document.getElementById("resultTitle"),
  resultText: document.getElementById("resultText"),
  resultRestartButton: document.getElementById("resultRestartButton"),
  currentPrize: document.getElementById("currentPrize"),
  prizeList: document.getElementById("prizeList"),
  timer: document.getElementById("timer"),
  timerValue: document.getElementById("timerValue"),
  timerProgress: document.getElementById("timerProgress"),
  introVideo: document.getElementById("introVideo"),
  introVideoMedia: document.getElementById("introVideoMedia"),
  helperModal: document.getElementById("helperModal"),
  helperTitle: document.getElementById("helperTitle"),
  helperContent: document.getElementById("helperContent"),
  closeHelper: document.getElementById("closeHelper"),
  managerModal: document.getElementById("managerModal"),
  managerNotice: document.getElementById("managerNotice"),
  managerTooltip: document.getElementById("managerTooltip"),
  backToHomeButton: document.getElementById("backToHomeButton"),
  previewGameButton: document.getElementById("previewGameButton"),
  importGameButton: document.getElementById("importGameButton"),
  importGameFile: document.getElementById("importGameFile"),
  saveGameButton: document.getElementById("saveGameButton"),
  backgroundUrl: document.getElementById("backgroundUrl"),
  applyBackgroundUrl: document.getElementById("applyBackgroundUrl"),
  backgroundUpload: document.getElementById("backgroundUpload"),
  resetBackground: document.getElementById("resetBackground"),
  quickBackgroundUpload: document.getElementById("quickBackgroundUpload"),
  backgroundPreview: document.getElementById("backgroundPreview"),
  backgroundSettings: document.getElementById("backgroundSettings"),
  questionSettings: document.getElementById("questionSettings"),
  managerPreviewPanel: document.querySelector(".manager-preview-panel"),
  questionPackage: document.getElementById("questionPackage"),
  questionEditor: document.getElementById("questionEditor"),
  editorQuestionText: document.getElementById("editorQuestionText"),
  editorOptions: [0, 1, 2, 3].map((index) => document.getElementById(`editorOption${index}`)),
  editorCorrect: document.getElementById("editorCorrect"),
  cancelQuestionButton: document.getElementById("cancelQuestionButton"),
  pickedQuestionCount: document.getElementById("pickedQuestionCount"),
  questionBankList: document.getElementById("questionBankList"),
  randomQuestionsButton: document.getElementById("randomQuestionsButton"),
  importPickedQuestions: document.getElementById("importPickedQuestions"),
  importedQuestions: document.getElementById("importedQuestions"),
  importedQuestionsList: document.getElementById("importedQuestionsList"),
  questionSlotPills: document.getElementById("questionSlotPills"),
  gameSlotList: document.getElementById("gameSlotList"),
  gameListSummary: document.getElementById("gameListSummary"),
  loadIntoGameButton: document.getElementById("loadIntoGameButton"),
  packageModal: document.getElementById("packageModal"),
  closePackageModal: document.getElementById("closePackageModal"),
  packageList: document.getElementById("packageList"),
  classPicker: document.getElementById("classPicker"),
  classSelection: document.getElementById("classSelection"),
  introSubtitle: document.getElementById("introSubtitle"),
  sounds: {
    background: document.getElementById("soundBackground"),
    main: document.getElementById("soundMain"),
    final: document.getElementById("soundFinal"),
    correct: document.getElementById("soundCorrect"),
    wrong: document.getElementById("soundWrong"),
    fifty: document.getElementById("soundFifty"),
    phone: document.getElementById("soundPhone"),
    hover: document.getElementById("soundHover"),
  },
};

function formatSeeds(value) {
  return `$${value.toLocaleString("vi-VN")}`;
}

function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const otherIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[otherIndex]] = [shuffled[otherIndex], shuffled[index]];
  }
  return shuffled;
}

function showManagerNotice(message, type = "success") {
  window.clearTimeout(state.managerNoticeTimer);
  els.managerNotice.textContent = message;
  els.managerNotice.dataset.type = type;
  els.managerNotice.hidden = false;
  state.managerNoticeTimer = window.setTimeout(() => {
    els.managerNotice.hidden = true;
  }, 2800);
}

const tooltipDescriptions = {
  backToHomeButton: "Quay về màn hình chính; nội dung bạn đang soạn vẫn được giữ trong tab này.",
  previewGameButton: "Khi chưa đủ 15 câu, mở thử đúng câu đang soạn. Khi đủ 15 câu, bắt đầu lượt chơi thật.",
  importGameButton: "Nạp lại bộ câu hỏi từ tệp JSON đã lưu trước đó.",
  saveGameButton: "Tải bộ câu hỏi hiện tại thành tệp JSON, gồm cả ảnh đã nhúng.",
  randomQuestionsButton: "Chọn ngẫu nhiên 15 câu từ gói hiện tại và nạp vào danh sách trò chơi.",
  importPickedQuestions: "Đưa các câu đã tích vào danh sách 15 câu để tiếp tục chỉnh sửa.",
  loadIntoGameButton: "Nạp đủ 15 câu hiện tại để sẵn sàng vào game.",
  applyBackgroundUrl: "Áp dụng ảnh nền từ liên kết trực tiếp.",
  resetBackground: "Trả lại hình nền mặc định.",
  introButton: "Phát video dạo đầu của trò chơi.",
  fullscreenButton: "Bật hoặc tắt chế độ toàn màn hình.",
  settingsButton: "Mở phần cài đặt và đổi hình nền sân chơi.",
  endGameButton: "Kết thúc lượt chơi hiện tại và trở về màn hình chính.",
};

function applyTooltips(root = document) {
  root.querySelectorAll("button").forEach((button) => {
    const description = tooltipDescriptions[button.id];
    if (description) button.dataset.tooltip = description;
    else if (!button.matches(".question-slot-pill")) delete button.dataset.tooltip;
  });
}

function showManagerTooltip(target) {
  const message = target.dataset.tooltip;
  if (!message || els.managerModal.hidden) return;
  const tooltip = els.managerTooltip;
  tooltip.textContent = message;
  tooltip.hidden = false;
  tooltip.style.visibility = "hidden";
  tooltip.style.left = "0px";
  tooltip.style.top = "0px";
  const targetRect = target.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const gap = 9;
  const placeBelow = targetRect.top < tooltipRect.height + gap + 8;
  const top = placeBelow ? targetRect.bottom + gap : targetRect.top - tooltipRect.height - gap;
  const left = Math.max(8, Math.min(targetRect.left, window.innerWidth - tooltipRect.width - 8));
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${Math.max(8, top)}px`;
  tooltip.style.visibility = "visible";
}

function hideManagerTooltip() {
  els.managerTooltip.hidden = true;
}

function getSelectedClass() {
  return classBank.find((item) => item.id === state.selectedClassId) || null;
}

function selectClass(classId) {
  const selectedClass = classBank.find((item) => item.id === classId);
  if (!selectedClass) return;
  state.selectedClassId = classId;
  els.startButton.disabled = false;
  els.classSelection.textContent = `Gói câu hỏi: ${selectedClass.name} - 15 câu ngẫu nhiên`;
  els.classPicker.querySelectorAll(".class-button").forEach((button) => {
    button.classList.toggle("selected", button.dataset.classId === classId);
  });
}

function renderClassPicker() {
  els.classPicker.innerHTML = "";
  if (!classBank.length) {
    els.classSelection.textContent = "Không thể tải ngân hàng câu hỏi.";
    els.startButton.disabled = true;
    return;
  }
  selectClass(state.selectedClassId || classBank[0].id);
}

function buildRoundQuestions(selectedClass) {
  if (hasFullGameList()) {
    return state.importedQuestionIds
      .map((questionId) => selectedClass.questions.find((question) => question.id === questionId))
      .filter(Boolean);
  }
  return shuffle(selectedClass.questions.filter((question) => question.options.length === 4)).slice(0, 15);
}

function stainedGlass(content) {
  return `
    <path d="M0 0h800v360H0z" fill="rgba(255,255,255,.03)"/>
    <path d="M0 92h800M0 196h800M158 0v360M322 0v360M492 0v360M646 0v360" stroke="rgba(255,255,255,.18)" stroke-width="5"/>
    <path d="M0 0 800 360M800 0 0 360" stroke="rgba(255,255,255,.11)" stroke-width="4"/>
    ${content}
  `;
}

function svgData(kind, label) {
  const scenes = {
    trinity: { bg: "#214d7f", body: stainedGlass(`<circle cx="400" cy="178" r="92" fill="none" stroke="#ffe08a" stroke-width="14"/><path d="M400 82v192M306 178h188" stroke="#fff4c4" stroke-width="16" stroke-linecap="round"/><circle cx="400" cy="178" r="18" fill="#e85d75"/>`) },
    prayer: { bg: "#59613a", body: stainedGlass(`<path d="M340 92c-42 55-50 100-23 145 20 33 45 51 83 77 38-26 63-44 83-77 27-45 19-90-23-145-30 34-47 54-60 91-13-37-30-57-60-91z" fill="#ffd86a"/><path d="M258 270h284" stroke="#fff4c4" stroke-width="12" stroke-linecap="round"/>`) },
    baptism: { bg: "#14728b", body: stainedGlass(`<path d="M400 68c58 78 94 134 94 182 0 52-42 86-94 86s-94-34-94-86c0-48 36-104 94-182z" fill="#8ee8ff"/><path d="M315 223c50 36 119 36 170 0" stroke="#ffffff" stroke-width="10" fill="none" stroke-linecap="round"/><path d="M400 118v98M352 166h96" stroke="#205c8a" stroke-width="11" stroke-linecap="round"/>`) },
    mass: { bg: "#743352", body: stainedGlass(`<path d="M248 283h304l-42-142H290z" fill="#f8d071"/><path d="M330 132h140l-20 76H350z" fill="#fff2ba"/><circle cx="400" cy="104" r="42" fill="#fff8d6"/><path d="M400 66v76M362 104h76" stroke="#a73f4e" stroke-width="9" stroke-linecap="round"/>`) },
    bible: { bg: "#654727", body: stainedGlass(`<path d="M238 88h270c36 0 54 18 54 54v142H278c-28 0-48-18-48-46V96c0-4 3-8 8-8z" fill="#8b2e36"/><path d="M278 284h284v32H278c-28 0-48-16-48-39v-5c12 8 28 12 48 12z" fill="#f5d98b"/><path d="M400 122v96M354 170h92" stroke="#fff4c4" stroke-width="12" stroke-linecap="round"/>`) },
    love: { bg: "#9a3150", body: stainedGlass(`<path d="M400 287C260 196 246 104 318 83c38-11 68 8 82 41 14-33 44-52 82-41 72 21 58 113-82 204z" fill="#ff7890"/><path d="M252 305h296" stroke="#ffe08a" stroke-width="12" stroke-linecap="round"/>`) },
    eucharist: { bg: "#2f5f61", body: stainedGlass(`<circle cx="400" cy="126" r="56" fill="#fff7cf"/><path d="M400 83v86M357 126h86" stroke="#caa034" stroke-width="8" stroke-linecap="round"/><path d="M334 205h132l-26 104h-80z" fill="#ffe08a"/><path d="M330 205h140" stroke="#fff7cf" stroke-width="16" stroke-linecap="round"/>`) },
    mary: { bg: "#335c90", body: stainedGlass(`<circle cx="400" cy="98" r="42" fill="#ffe2b0"/><path d="M294 303c16-111 46-169 106-169s90 58 106 169z" fill="#4ea8de"/><path d="M350 138c15 24 85 24 100 0" stroke="#fff7cf" stroke-width="10" stroke-linecap="round"/><path d="M332 84c36-54 100-54 136 0" stroke="#ffd86a" stroke-width="9" fill="none"/>`) },
    spirit: { bg: "#6f3d7b", body: stainedGlass(`<path d="M250 207c90-9 107-84 150-118 43 34 60 109 150 118-66 55-129 68-150 68s-84-13-150-68z" fill="#fff7cf"/><path d="M400 91c-16 56-12 112 0 167" stroke="#ffd86a" stroke-width="10" stroke-linecap="round"/><circle cx="400" cy="286" r="22" fill="#ffcf40"/>`) },
    advent: { bg: "#4b3678", body: stainedGlass(`<circle cx="400" cy="190" r="108" fill="none" stroke="#1f8f69" stroke-width="24"/><circle cx="315" cy="114" r="18" fill="#8b5cf6"/><circle cx="485" cy="114" r="18" fill="#8b5cf6"/><circle cx="315" cy="266" r="18" fill="#e76f9a"/><circle cx="485" cy="266" r="18" fill="#8b5cf6"/><path d="M400 75v120" stroke="#ffd86a" stroke-width="10" stroke-linecap="round"/>`) },
    lent: { bg: "#5b4168", body: stainedGlass(`<path d="M400 75v220M320 145h160" stroke="#d6b2ff" stroke-width="18" stroke-linecap="round"/><path d="M270 302h260" stroke="#ffe08a" stroke-width="12" stroke-linecap="round"/><text x="400" y="246" font-size="58" text-anchor="middle" font-weight="900" fill="#fff7cf">40</text>`) },
    resurrection: { bg: "#c97d2c", body: stainedGlass(`<path d="M254 300c12-112 76-184 146-184s134 72 146 184z" fill="#fff0b3"/><path d="M400 72v134M340 130h120" stroke="#d58b24" stroke-width="13" stroke-linecap="round"/><path d="M185 300h430" stroke="#6b3c1e" stroke-width="12" stroke-linecap="round"/>`) },
    reconciliation: { bg: "#235f54", body: stainedGlass(`<path d="M282 266c40-82 68-118 118-118s78 36 118 118" stroke="#fff4c4" stroke-width="18" fill="none" stroke-linecap="round"/><path d="M319 165c34 38 128 38 162 0" stroke="#ffd86a" stroke-width="12" fill="none" stroke-linecap="round"/><path d="M400 80v86M358 122h84" stroke="#bfe8d3" stroke-width="10" stroke-linecap="round"/>`) },
    commandments: { bg: "#686053", body: stainedGlass(`<path d="M238 300V128c0-45 36-80 80-80s80 35 80 80v172z" fill="#d3c7b0"/><path d="M402 300V128c0-45 36-80 80-80s80 35 80 80v172z" fill="#b9ad98"/><text x="318" y="190" font-size="66" text-anchor="middle" font-weight="900" fill="#594734">I</text><text x="482" y="190" font-size="66" text-anchor="middle" font-weight="900" fill="#594734">X</text>`) },
    service: { bg: "#3b6d48", body: stainedGlass(`<path d="M305 160c35 35 65 35 95 0 30 35 60 35 95 0" stroke="#ffe08a" stroke-width="18" fill="none" stroke-linecap="round"/><path d="M226 250c87 46 261 46 348 0" stroke="#fff7cf" stroke-width="16" fill="none" stroke-linecap="round"/><path d="M400 92v116M346 145h108" stroke="#91e8b0" stroke-width="12" stroke-linecap="round"/>`) },
  };
  const scene = scenes[kind] || scenes.trinity;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 360"><rect width="800" height="360" fill="${scene.bg}"/><circle cx="90" cy="64" r="90" fill="rgba(255,255,255,.08)"/><circle cx="708" cy="72" r="118" fill="rgba(255,255,255,.07)"/>${scene.body}<text x="32" y="328" font-family="Arial, sans-serif" font-size="28" font-weight="800" fill="rgba(255,255,255,.78)">${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function playSound(name, { loop = false, volume = 0.7, restart = true } = {}) {
  const sound = els.sounds[name];
  if (!sound) return;
  sound.loop = loop;
  sound.volume = volume;
  if (restart) sound.currentTime = 0;
  sound.play().catch(() => {});
}

function stopSound(name) {
  const sound = els.sounds[name];
  if (!sound) return;
  sound.pause();
  sound.currentTime = 0;
}

function renderPrizeList() {
  els.prizeList.innerHTML = "";
  prizes
    .map((value, index) => ({ value, level: index + 1 }))
    .reverse()
    .forEach(({ value, level }) => {
      const li = document.createElement("li");
      li.className = "prize-item";
      if ([5, 10, 15].includes(level)) li.classList.add("safe");
      if (level === state.questionIndex + 1 && !els.questionScreen.hidden) li.classList.add("active");
      if (level <= state.questionIndex && state.prize >= value) li.classList.add("cleared");
      li.innerHTML = `<span>${level}</span><strong>${formatSeeds(value)}</strong>`;
      els.prizeList.appendChild(li);
    });
  els.currentPrize.textContent = formatSeeds(state.prize);
}

function renderQuestion() {
  const question = questions[state.questionIndex];
  state.selected = null;
  state.locked = false;
  state.eliminated = new Set();
  state.timeLeft = maxTime;
  els.questionText.textContent = question.text;
  const imageAlt = question.alt || getSelectedClass()?.name || "Câu hỏi giáo lý";
  els.questionImage.alt = imageAlt;
  if (question.imageUrl) {
    els.questionImage.hidden = false;
    els.questionImage.src = question.imageUrl;
    els.questionImage.onerror = () => {
      els.questionImage.hidden = true;
      els.questionImage.removeAttribute("src");
    };
  } else {
    els.questionImage.hidden = true;
    els.questionImage.removeAttribute("src");
    els.questionImage.onerror = null;
  }
  els.answers.innerHTML = "";
  question.options.forEach((option, index) => {
    const button = document.createElement("button");
    button.className = "answer";
    button.type = "button";
    button.dataset.index = String(index);
    button.innerHTML = `<span class="answer-letter">${letters[index]}</span><span class="answer-text">${option}</span>`;
    button.addEventListener("click", () => chooseAnswer(index));
    els.answers.appendChild(button);
  });
  els.finalButton.hidden = true;
  els.nextButton.hidden = true;
  els.restartButton.hidden = true;
  els.timer.hidden = false;
  renderPrizeList();
  startTimer();
}

function chooseAnswer(index) {
  if (state.locked || state.eliminated.has(index)) return;
  playSound("hover", { volume: 0.45 });
  state.selected = index;
  document.querySelectorAll(".answer").forEach((button) => button.classList.remove("selected"));
  getAnswerButton(index).classList.add("selected");
  els.finalButton.hidden = false;
  els.nextButton.hidden = true;
}

function finalAnswer() {
  if (state.selected === null || state.locked) return;
  state.locked = true;
  stopTimer();
  setAnswersDisabled(true);
  els.finalButton.hidden = true;
  const question = questions[state.questionIndex];
  const selectedButton = getAnswerButton(state.selected);
  selectedButton.classList.add("selected");
  playSound("final", { volume: 0.65 });
  setTimeout(() => {
    const correct = state.selected === question.correct;
    selectedButton.classList.remove("selected");
    getAnswerButton(question.correct).classList.add("correct");
    if (!correct) selectedButton.classList.add("wrong");
    if (correct) {
      state.prize = prizes[state.questionIndex];
      playSound("correct", { volume: 0.7 });
      renderPrizeList();
      if (state.questionIndex === questions.length - 1) {
        showEnd("Hoàn thành hành trình giáo lý!", `Đội của bạn đạt ${formatSeeds(state.prize)}. Một tràng pháo tay thật lớn nhé!`);
        return;
      }
      els.nextButton.hidden = false;
    } else {
      playSound("wrong", { volume: 0.7 });
      const safePrize = getSafePrize();
      showEnd("Cùng học thêm nhé!", `Đội của bạn giữ ${formatSeeds(safePrize)}. Đáp án đúng là ${letters[question.correct]}: ${question.options[question.correct]}.`);
    }
  }, 1200);
}

function nextQuestion() {
  state.questionIndex += 1;
  renderQuestion();
}

function getSafePrize() {
  if (state.questionIndex >= 10) return prizes[9];
  if (state.questionIndex >= 5) return prizes[4];
  return 0;
}

function getAnswerButton(index) {
  return els.answers.querySelector(`[data-index="${index}"]`);
}

function setAnswersDisabled(disabled) {
  els.answers.querySelectorAll(".answer").forEach((button) => {
    button.disabled = disabled || state.eliminated.has(Number(button.dataset.index));
  });
}

function startTimer() {
  stopTimer();
  updateTimer();
  state.timerId = window.setInterval(() => {
    state.timeLeft -= 1;
    updateTimer();
    if (state.timeLeft <= 0) {
      stopTimer();
      state.locked = true;
      setAnswersDisabled(true);
      showEnd("Hết giờ!", `Đội của bạn giữ ${formatSeeds(getSafePrize())}. Cả lớp cùng xem lại câu này nhé.`);
    }
  }, 1000);
}

function stopTimer() {
  if (state.timerId) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
}

function updateHelperTimer() {
  const countdown = document.getElementById("helperCountdown");
  if (countdown) countdown.textContent = String(Math.max(0, state.helperTimeLeft));
}

function stopHelperTimer() {
  if (!state.helperTimerId) return;
  window.clearInterval(state.helperTimerId);
  state.helperTimerId = null;
}

function startHelperTimer() {
  stopHelperTimer();
  state.helperTimeLeft = helperDuration;
  updateHelperTimer();
  state.helperTimerId = window.setInterval(() => {
    state.helperTimeLeft -= 1;
    updateHelperTimer();
    if (state.helperTimeLeft <= 0) {
      stopHelperTimer();
      closeHelper();
    }
  }, 1000);
}

function updateTimer() {
  els.timerValue.textContent = String(Math.max(0, state.timeLeft));
  const offset = ringLength * (1 - Math.max(0, state.timeLeft) / maxTime);
  els.timerProgress.style.strokeDashoffset = String(offset);
}

function startGame() {
  const selectedClass = getSelectedClass();
  if (!selectedClass) return;
  questions = buildRoundQuestions(selectedClass);
  if (questions.length < 15) return;
  state.questionIndex = 0;
  state.prize = 0;
  state.selected = null;
  state.locked = false;
  state.used = { fifty: false, phone: false, audience: false, host: false };
  document.querySelectorAll(".lifeline").forEach((button) => {
    button.disabled = false;
    button.classList.remove("used");
  });
  els.resultPanel.hidden = true;
  playIntro(() => {
    els.introScreen.hidden = true;
    els.questionScreen.hidden = false;
    els.endGameButton.hidden = false;
    playSound("background", { loop: true, volume: 0.28 });
    renderQuestion();
  });
}

function playIntro(done) {
  els.introVideo.hidden = false;
  const video = els.introVideoMedia;
  let completed = false;
  const finish = () => {
    if (completed) return;
    completed = true;
    video.pause();
    video.currentTime = 0;
    els.introVideo.hidden = true;
    state.introFinish = null;
    if (done) done();
  };
  state.introFinish = finish;
  video.onended = finish;
  video.currentTime = 0;
  video.play().catch(() => {
    window.setTimeout(finish, 2600);
  });
}

function restartGame() {
  stopTimer();
  stopSound("background");
  els.resultPanel.hidden = true;
  els.questionScreen.hidden = true;
  els.introScreen.hidden = false;
  els.timer.hidden = true;
  els.endGameButton.hidden = true;
  state.prize = 0;
  state.questionIndex = 0;
  els.introSubtitle.textContent = "Chọn gói câu hỏi sẵn theo lớp hoặc tạo riêng cho chính bạn.";
  els.startButton.disabled = !state.selectedClassId;
  renderClassPicker();
  renderPrizeList();
}

function endGame() {
  restartGame();
}

function showEnd(title, text) {
  stopTimer();
  stopSound("background");
  els.timer.hidden = true;
  els.resultTitle.textContent = title;
  els.resultText.textContent = text;
  els.resultPanel.hidden = false;
  renderPrizeList();
}

function useLifeline(type) {
  if (state.used[type] || els.questionScreen.hidden || state.locked) return;
  const button = document.querySelector(`[data-lifeline="${type}"]`);
  state.used[type] = true;
  button.disabled = true;
  button.classList.add("used");
  const question = questions[state.questionIndex];

  if (type === "fifty") {
    playSound("fifty", { volume: 0.7 });
    const wrongIndexes = [0, 1, 2, 3].filter((index) => index !== question.correct);
    wrongIndexes.sort(() => Math.random() - 0.5).slice(0, 2).forEach((index) => state.eliminated.add(index));
    state.eliminated.forEach((index) => {
      const answer = getAnswerButton(index);
      answer.classList.add("eliminated");
      answer.disabled = true;
    });
    return;
  }

  const helperMessages = {
    host: ["Hỏi giáo lý viên", "Trao đổi với giáo lý viên trong 30 giây."],
    audience: ["Hỏi cả lớp", "Lắng nghe ý kiến cả lớp trong 30 giây."],
    phone: ["Hỏi một bạn", "Trao đổi với một bạn trong 30 giây."],
  };
  const [title, message] = helperMessages[type];
  if (type === "phone") playSound("phone", { volume: 0.7 });
  showHelper(title, `<div class="helper-countdown" id="helperCountdown">30</div><p class="helper-caption">${message}</p>`);
}

function showHelper(title, content) {
  stopTimer();
  els.helperTitle.textContent = title;
  els.helperContent.innerHTML = content;
  els.helperModal.hidden = false;
  startHelperTimer();
}

function closeHelper() {
  stopHelperTimer();
  els.helperModal.hidden = true;
  if (!state.locked && !els.questionScreen.hidden) startTimer();
}

function getManagedClass() {
  return classBank.find((item) => item.id === els.questionPackage.value) || getSelectedClass() || classBank[0] || null;
}

function renderQuestionPackages() {
  const previous = els.questionPackage.value || state.selectedClassId;
  els.questionPackage.innerHTML = "";
  classBank.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = `${item.name} (${item.questions.length} câu)`;
    els.questionPackage.appendChild(option);
  });
  els.questionPackage.value = classBank.some((item) => item.id === previous) ? previous : classBank[0]?.id || "";
}

function renderPackagePopup() {
  els.packageList.innerHTML = "";
  classBank.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${item.name} · ${item.questions.filter((question) => question.options.length === 4).length} câu`;
    button.classList.toggle("selected", item.id === els.questionPackage.value);
    button.addEventListener("click", () => {
      els.questionPackage.value = item.id;
      state.selectedClassId = item.id;
      state.selectedQuestionIds = new Set();
      state.importedQuestionIds = Array(15).fill(null);
      state.randomSelectionActive = false;
      renderClassPicker();
      renderQuestionManager();
      els.packageModal.hidden = true;
    });
    els.packageList.appendChild(button);
  });
}

function renderQuestionBankList() {
  const selectedClass = getManagedClass();
  if (!selectedClass) return;
  const availableQuestions = selectedClass.questions.filter((question) => question.options.length === 4);
  state.selectedQuestionIds = new Set([...state.selectedQuestionIds].filter((id) => availableQuestions.some((question) => question.id === id)));
  els.pickedQuestionCount.textContent = `Đã chọn ${state.selectedQuestionIds.size}/15`;
  els.randomQuestionsButton.textContent = state.randomSelectionActive ? "Bỏ chọn 15 câu ngẫu nhiên" : "Chọn ngẫu nhiên 15 câu";
  els.randomQuestionsButton.dataset.tooltip = state.randomSelectionActive
    ? "Bỏ nhanh 15 câu vừa chọn ngẫu nhiên và làm trống danh sách trò chơi."
    : tooltipDescriptions.randomQuestionsButton;
  els.randomQuestionsButton.classList.toggle("cancel-random", state.randomSelectionActive);
  // Có thể nhập để chỉnh sửa từ chỉ một câu; chỉ bước nạp vào game mới cần đủ 15 câu.
  els.importPickedQuestions.hidden = state.selectedQuestionIds.size === 0;
  if (state.selectedQuestionIds.size === 0 && !state.importedQuestionIds.some(Boolean)) {
    els.importedQuestions.hidden = true;
  }
  els.loadIntoGameButton.hidden = !hasFullGameList();
  els.questionBankList.innerHTML = "";
  availableQuestions.forEach((question) => {
    const label = document.createElement("label");
    label.className = "question-bank-item";
    label.dataset.tooltip = question.text;
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = state.selectedQuestionIds.has(question.id);
    input.disabled = !input.checked && state.selectedQuestionIds.size >= 15;
    input.addEventListener("change", () => {
      if (input.checked) state.selectedQuestionIds.add(question.id);
      else state.selectedQuestionIds.delete(question.id);
      state.randomSelectionActive = false;
      renderQuestionBankList();
    });
    const number = document.createElement("strong");
    number.textContent = `Câu ${question.id}`;
    const preview = document.createElement("span");
    preview.textContent = question.text;
    label.append(input, number, preview);
    els.questionBankList.appendChild(label);
  });
  applyTooltips(els.questionBankList);
}

function chooseRandomQuestions() {
  const selectedClass = getManagedClass();
  if (!selectedClass) return;
  if (state.randomSelectionActive) {
    state.selectedQuestionIds = new Set();
    state.importedQuestionIds = Array(15).fill(null);
    state.randomSelectionActive = false;
    els.importedQuestions.hidden = true;
    els.loadIntoGameButton.hidden = true;
    renderQuestionManager();
    return;
  }
  state.selectedQuestionIds = new Set(shuffle(selectedClass.questions.filter((question) => question.options.length === 4)).slice(0, 15).map((question) => question.id));
  state.randomSelectionActive = true;
  renderQuestionManager();
  importPickedQuestions();
}

function renderQuestionSlotPills() {
  const selectedClass = getManagedClass();
  if (!selectedClass) return;
  els.questionSlotPills.innerHTML = "";
  els.gameSlotList.innerHTML = "";
  const filledCount = state.importedQuestionIds.filter((questionId) => questionId !== null).length;
  els.gameListSummary.textContent = `DANH SÁCH CÂU HỎI TRONG TRÒ CHƠI (${filledCount}/15)`;
  state.importedQuestionIds.forEach((questionId, slotIndex) => {
    const questionIndex = selectedClass.questions.findIndex((question) => question.id === questionId);
    const hasContent = questionIndex >= 0;
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = "question-slot-pill";
    pill.textContent = `Câu ${slotIndex + 1}`;
    pill.classList.toggle("has-content", hasContent);
    pill.classList.toggle("empty", !hasContent);
    pill.disabled = !hasContent;
    if (hasContent) {
      pill.addEventListener("click", () => {
        document.getElementById(`game-slot-${slotIndex}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
        els.questionSlotPills.querySelectorAll("button").forEach((button) => button.classList.remove("active"));
        pill.classList.add("active");
      });
    }
    els.questionSlotPills.appendChild(pill);

    const slot = document.createElement("details");
    slot.id = `game-slot-${slotIndex}`;
    slot.className = "game-slot-card";
    slot.open = state.activeSlotIndex === slotIndex;
    slot.classList.toggle("has-content", hasContent);
    const summary = document.createElement("summary");
    summary.innerHTML = `<span>Câu ${slotIndex + 1}</span><small>${hasContent ? "Đã có nội dung" : "Chưa có nội dung"}</small><b>⌄</b>`;
    slot.appendChild(summary);
    slot.appendChild(createSlotQuestionEditor(selectedClass, slotIndex, questionIndex >= 0 ? selectedClass.questions[questionIndex] : null, questionIndex));
    slot.addEventListener("toggle", () => {
      if (!slot.open) return;
      state.activeSlotIndex = slotIndex;
      els.gameSlotList.querySelectorAll("details[open]").forEach((otherSlot) => {
        if (otherSlot !== slot) otherSlot.open = false;
      });
    });
    els.gameSlotList.appendChild(slot);
  });
  applyTooltips(els.questionSlotPills);
  applyTooltips(els.gameSlotList);
}

function createSlotQuestionEditor(selectedClass, slotIndex, question, questionIndex) {
  const form = document.createElement("form");
  form.className = "slot-question-editor";
  const questionField = document.createElement("div");
  questionField.className = "slot-question-field";
  const textLabel = document.createElement("label");
  textLabel.textContent = "Nội dung câu hỏi";
  const text = document.createElement("textarea");
  text.required = true;
  text.value = question?.text || "";
  questionField.append(textLabel, text);
  const mediaField = document.createElement("div");
  mediaField.className = "slot-media-field";
  const imageLabel = document.createElement("label");
  imageLabel.textContent = "Hình ảnh (không bắt buộc)";
  const imageUrlInput = document.createElement("input");
  imageUrlInput.type = "url";
  imageUrlInput.placeholder = "Chèn link ảnh trực tiếp (được giữ lại)";
  imageUrlInput.value = question?.imageUrl && !question.imageUrl.startsWith("blob:") ? question.imageUrl : "";
  const image = document.createElement("input");
  image.type = "file";
  image.accept = "image/*";
  const imageHint = document.createElement("span");
  imageHint.textContent = question?.imageUrl ? "Đã có ảnh cho câu hỏi" : "Hoặc tải ảnh từ máy — ảnh chỉ dùng trong lần mở web này";
  const imagePreview = document.createElement("img");
  imagePreview.className = "slot-image-preview";
  imagePreview.alt = "Ảnh của câu hỏi";
  let imageUrl = question?.imageUrl || "";
  let embeddedImageData = question?.imageData || "";
  let imageLoading = false;
  const updateImagePreview = (source) => {
    imagePreview.hidden = !source;
    if (source) imagePreview.src = source;
    else imagePreview.removeAttribute("src");
  };
  updateImagePreview(imageUrl);
  imageUrlInput.addEventListener("input", () => {
    imageUrl = imageUrlInput.value.trim();
    embeddedImageData = "";
    updateImagePreview(imageUrl);
    if (imageUrl) imageHint.textContent = "Đang dùng link ảnh trực tiếp";
  });
  image.addEventListener("change", () => {
    const [file] = image.files;
    if (!file) return;
    if (file.size > maxQuestionImageBytes) {
      image.value = "";
      imageHint.textContent = "Ảnh vượt quá giới hạn 5 MB";
      showManagerNotice("Không thể tải ảnh lớn hơn 5 MB.", "error");
      return;
    }
    imageUrl = URL.createObjectURL(file);
    updateImagePreview(imageUrl);
    imageLoading = true;
    imageHint.textContent = `Đang xử lý: ${file.name}`;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      embeddedImageData = String(reader.result || "");
      imageUrl = embeddedImageData;
      imageLoading = false;
      updateImagePreview(imageUrl);
      imageHint.textContent = `Đã tải: ${file.name} — sẽ nhúng vào JSON khi lưu trò chơi`;
    });
    reader.addEventListener("error", () => {
      imageLoading = false;
      imageHint.textContent = "Không thể đọc tệp ảnh";
      showManagerNotice("Không thể đọc tệp ảnh.", "error");
    });
    reader.readAsDataURL(file);
  });
  mediaField.append(imageLabel, imageUrlInput, image, imageHint, imagePreview);
  const answers = document.createElement("div");
  answers.className = "slot-answer-list";
  const optionInputs = letters.map((letter, index) => {
    const row = document.createElement("label");
    row.className = "slot-answer-row";
    const badge = document.createElement("b");
    badge.textContent = letter;
    const input = document.createElement("input");
    input.required = true;
    input.value = question?.options[index] || "";
    input.placeholder = `Đáp án ${letter}`;
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = `correct-${slotIndex}`;
    radio.value = String(index);
    radio.checked = (question?.correct ?? 0) === index;
    row.append(badge, input, radio);
    answers.appendChild(row);
    return input;
  });
  const actions = document.createElement("div");
  actions.className = "slot-editor-actions";
  const save = document.createElement("button");
  save.type = "submit";
  save.textContent = "Lưu câu hỏi";
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "delete-slot-question";
  remove.textContent = "Xóa câu";
  remove.disabled = !question;
  actions.append(save, remove);
  form.append(questionField, mediaField, answers, actions);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (imageLoading) {
      showManagerNotice("Đợi ảnh tải xong rồi hãy lưu câu hỏi.", "error");
      return;
    }
    const correct = Number(form.querySelector(`input[name="correct-${slotIndex}"]:checked`)?.value || 0);
    const payload = { text: text.value.trim(), imageUrl, imageData: embeddedImageData, options: optionInputs.map((input) => input.value.trim()), correct };
    if (payload.options.some((option) => !option) || !payload.text) return;
    if (questionIndex >= 0) {
      selectedClass.questions[questionIndex] = { ...selectedClass.questions[questionIndex], ...payload };
    } else {
      const lastId = Math.max(0, ...selectedClass.questions.map((item) => Number(item.id) || 0));
      const newQuestion = { id: lastId + 1, ...payload };
      selectedClass.questions.push(newQuestion);
      state.importedQuestionIds[slotIndex] = newQuestion.id;
      state.selectedQuestionIds.add(newQuestion.id);
    }
    state.activeSlotIndex = slotIndex;
    renderQuestionManager();
    showManagerNotice(`Đã lưu Câu ${slotIndex + 1}.`);
  });
  remove.addEventListener("click", () => {
    if (!question) return;
    state.importedQuestionIds[slotIndex] = null;
    state.selectedQuestionIds.delete(question.id);
    state.activeSlotIndex = slotIndex;
    renderQuestionManager();
  });
  return form;
}

function addQuestionToGameList(questionId) {
  if (!state.selectedQuestionIds.has(questionId) && state.selectedQuestionIds.size < 15) {
    state.selectedQuestionIds.add(questionId);
  }
  if (!state.importedQuestionIds.includes(questionId)) {
    const emptySlot = state.importedQuestionIds.findIndex((id) => id === null);
    if (emptySlot >= 0) state.importedQuestionIds[emptySlot] = questionId;
  }
}

function hasFullGameList() {
  return state.importedQuestionIds.every((questionId) => questionId !== null);
}

function updateManagerGameAction() {
  const readyToPlay = hasFullGameList();
  els.previewGameButton.textContent = readyToPlay ? "▶ Vào game" : "◉ Xem trước trò chơi";
  els.previewGameButton.classList.toggle("ready-to-play", readyToPlay);
}

function renderImportedQuestions({ scroll = false } = {}) {
  const selectedClass = getManagedClass();
  if (!selectedClass) return;
  els.importedQuestionsList.innerHTML = "";
  renderQuestionSlotPills();
  updateManagerGameAction();
  els.importedQuestions.hidden = true;
  els.loadIntoGameButton.hidden = !hasFullGameList();
  if (scroll) {
    els.gameSlotList.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function importPickedQuestions() {
  const selectedClass = getManagedClass();
  if (!selectedClass || state.selectedQuestionIds.size === 0) return;
  const pickedQuestions = selectedClass.questions
    .map((question, index) => ({ question, index }))
    .filter(({ question }) => state.selectedQuestionIds.has(question.id));
  state.importedQuestionIds = pickedQuestions.slice(0, 15).map(({ question }) => question.id);
  while (state.importedQuestionIds.length < 15) state.importedQuestionIds.push(null);
  renderImportedQuestions({ scroll: true });
}

function createImportedQuestionEditor(selectedClass, question, index, slotIndex) {
  const form = document.createElement("form");
  form.className = "imported-question-editor";
  form.id = `imported-question-${slotIndex}`;
  const title = document.createElement("h5");
  title.textContent = `Câu ${slotIndex + 1} · Nguồn: Câu ${question.id}`;
  const questionLabel = document.createElement("label");
  questionLabel.textContent = "Nội dung câu hỏi";
  const questionText = document.createElement("textarea");
  questionText.value = question.text;
  const optionsWrap = document.createElement("div");
  optionsWrap.className = "imported-editor-options";
  const optionInputs = letters.map((letter, optionIndex) => {
    const label = document.createElement("label");
    label.textContent = `Đáp án ${letter}`;
    const input = document.createElement("input");
    input.value = question.options[optionIndex] || "";
    input.required = true;
    label.appendChild(input);
    optionsWrap.appendChild(label);
    return input;
  });
  const correctLabel = document.createElement("label");
  correctLabel.textContent = "Đáp án đúng";
  const correct = document.createElement("select");
  letters.forEach((letter, optionIndex) => {
    const option = document.createElement("option");
    option.value = String(optionIndex);
    option.textContent = letter;
    option.selected = optionIndex === question.correct;
    correct.appendChild(option);
  });
  const save = document.createElement("button");
  save.type = "submit";
  save.textContent = "Lưu chỉnh sửa";
  form.append(title, questionLabel, questionText, optionsWrap, correctLabel, correct, save);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    selectedClass.questions[index] = {
      ...selectedClass.questions[index],
      text: questionText.value.trim(),
      options: optionInputs.map((input) => input.value.trim()),
      correct: Number(correct.value),
    };
    renderQuestionBankList();
  });
  return form;
}

function startNewQuestion() {
  els.questionEditor.reset();
  els.editorCorrect.value = "0";
  els.editorQuestionText.focus();
}

function renderQuestionManager() {
  renderQuestionPackages();
  const selectedClass = getManagedClass();
  if (!selectedClass) return;
  renderImportedQuestions();
  renderQuestionBankList();
}

function saveQuestion(event) {
  event.preventDefault();
  const selectedClass = getManagedClass();
  const text = els.editorQuestionText.value.trim();
  const options = els.editorOptions.map((input) => input.value.trim());
  if (!selectedClass || !text || options.some((option) => !option)) return;
  const payload = { text, options, correct: Number(els.editorCorrect.value) };
  const lastId = Math.max(0, ...selectedClass.questions.map((question) => Number(question.id) || 0));
  const newQuestion = { id: lastId + 1, ...payload };
  selectedClass.questions.push(newQuestion);
  addQuestionToGameList(newQuestion.id);
  state.selectedClassId = selectedClass.id;
  renderClassPicker();
  renderQuestionManager();
  startNewQuestion();
}

function setManagerTab(tab) {
  const showingQuestions = tab === "questions";
  els.backgroundSettings.hidden = showingQuestions;
  els.managerPreviewPanel.hidden = showingQuestions;
  els.questionSettings.hidden = !showingQuestions;
  document.querySelectorAll("[data-manager-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.managerTab === tab);
  });
  if (showingQuestions) renderQuestionManager();
}

function setBackground(url) {
  const source = url || defaultBackground;
  state.backgroundSource = url || "";
  els.backgroundUrl.value = url && !url.startsWith("linear-gradient") ? url : "";
  const backgroundValue = source.startsWith("linear-gradient") ? source : `url("${source}")`;
  els.backgroundPreview.style.backgroundImage = backgroundValue;
  document.querySelector(".stage").style.backgroundImage = backgroundValue;
}

function applyBackgroundPreset(preset) {
  if (state.backgroundObjectUrl) {
    URL.revokeObjectURL(state.backgroundObjectUrl);
    state.backgroundObjectUrl = null;
  }
  state.backgroundImageData = "";
  setBackground(preset === "violet" ? "linear-gradient(135deg, #190d4c 0%, #3e167f 48%, #08194d 100%)" : "");
  document.querySelectorAll(".background-thumb").forEach((button) => button.classList.toggle("selected", button.dataset.backgroundPreset === preset));
}

function openManager() {
  stopTimer();
  setManagerTab("background");
  els.managerModal.hidden = false;
}

function openQuestionCreator() {
  stopTimer();
  els.managerModal.hidden = false;
  setManagerTab("questions");
  startNewQuestion();
}

function openPackagePicker() {
  renderPackagePopup();
  els.packageModal.hidden = false;
}

function loadIntoGame() {
  if (!hasFullGameList()) return;
  const selectedClass = getManagedClass();
  if (!selectedClass) return;
  state.selectedClassId = selectedClass.id;
  renderClassPicker();
  closeManager();
}

function previewGame() {
  if (hasFullGameList()) {
    closeManager();
    startGame();
    return;
  }
  const editor = els.gameSlotList.querySelector("details[open] .slot-question-editor");
  if (!editor) {
    window.alert("Hãy mở câu hỏi bạn muốn xem trước.");
    return;
  }
  const text = editor.querySelector("textarea")?.value.trim() || "";
  const optionInputs = [...editor.querySelectorAll('.slot-answer-row input:not([type="radio"])')];
  const options = optionInputs.map((input) => input.value.trim());
  if (!text || options.some((option) => !option)) {
    window.alert("Hãy nhập nội dung và đủ bốn đáp án trước khi xem trước.");
    return;
  }
  const correct = Number(editor.querySelector('input[type="radio"]:checked')?.value || 0);
  const imageFile = editor.querySelector('input[type="file"]')?.files?.[0];
  const imageUrl = editor.querySelector('input[type="url"]')?.value.trim() || (imageFile ? URL.createObjectURL(imageFile) : "");
  questions = [{ id: 0, text, options, correct, imageUrl }];
  state.questionIndex = 0;
  state.prize = 0;
  state.selected = null;
  state.locked = false;
  els.managerModal.hidden = true;
  els.resultPanel.hidden = true;
  els.introScreen.hidden = true;
  els.questionScreen.hidden = false;
  els.endGameButton.hidden = false;
  renderQuestion();
}

function saveGameFile() {
  const selectedClass = getManagedClass();
  const gameQuestions = state.importedQuestionIds
    .map((questionId) => selectedClass?.questions.find((question) => question.id === questionId))
    .filter(Boolean)
    .map((question) => {
      const { imageData, ...rest } = question;
      return { ...rest, imageUrl: imageData || rest.imageUrl || "" };
    });
  const payload = {
    title: "Ai là triệu phú Giáo lý",
    package: selectedClass?.name || "",
    questions: gameQuestions,
    background: state.backgroundImageData || state.backgroundSource || "",
    savedAt: new Date().toISOString(),
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "ai-la-trieu-phu-giao-ly.json";
  link.click();
  URL.revokeObjectURL(url);
}

function importGameFile(event) {
  const [file] = event.target.files;
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const payload = JSON.parse(String(reader.result || ""));
      if (!Array.isArray(payload.questions) || !payload.questions.length) throw new Error("empty");
      const targetClass = classBank.find((item) => item.name === payload.package) || getManagedClass() || classBank[0];
      if (!targetClass) throw new Error("package");
      const validQuestions = payload.questions
        .filter((question) => typeof question?.text === "string" && Array.isArray(question.options) && question.options.length === 4)
        .slice(0, 15);
      if (!validQuestions.length) throw new Error("questions");
      let lastId = Math.max(0, ...targetClass.questions.map((question) => Number(question.id) || 0));
      const importedIds = validQuestions.map((question) => {
        lastId += 1;
        const imported = {
          id: lastId,
          text: question.text,
          options: question.options.map((option) => String(option)),
          correct: Number.isInteger(question.correct) && question.correct >= 0 && question.correct <= 3 ? question.correct : 0,
          imageUrl: typeof question.imageUrl === "string" ? question.imageUrl : "",
        };
        targetClass.questions.push(imported);
        return imported.id;
      });
      state.selectedClassId = targetClass.id;
      els.questionPackage.value = targetClass.id;
      state.selectedQuestionIds = new Set(importedIds);
      state.importedQuestionIds = [...importedIds, ...Array(15 - importedIds.length).fill(null)];
      if (typeof payload.background === "string" && payload.background) setBackground(payload.background);
      renderClassPicker();
      setManagerTab("questions");
      renderQuestionManager();
    } catch {
      window.alert("Không đọc được tệp JSON game. Hãy chọn tệp được tạo bằng nút Lưu trò chơi.");
    } finally {
      event.target.value = "";
    }
  });
  reader.readAsText(file);
}

function closeManager() {
  els.managerModal.hidden = true;
  if (!state.locked && !els.questionScreen.hidden && els.helperModal.hidden) startTimer();
}

function applyBackgroundUrl() {
  const url = els.backgroundUrl.value.trim();
  if (!url) return;
  if (state.backgroundObjectUrl) {
    URL.revokeObjectURL(state.backgroundObjectUrl);
    state.backgroundObjectUrl = null;
  }
  state.backgroundImageData = "";
  setBackground(url);
}

function uploadBackground(event) {
  const [file] = event.target.files;
  if (!file) return;
  if (file.size > maxQuestionImageBytes) {
    event.target.value = "";
    showManagerNotice("Hình nền vượt quá giới hạn 5 MB.", "error");
    return;
  }
  if (state.backgroundObjectUrl) URL.revokeObjectURL(state.backgroundObjectUrl);
  state.backgroundObjectUrl = URL.createObjectURL(file);
  setBackground(state.backgroundObjectUrl);
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    state.backgroundImageData = String(reader.result || "");
    els.quickBackgroundUpload.style.backgroundImage = `url("${state.backgroundImageData}")`;
    els.quickBackgroundUpload.textContent = "";
    document.querySelectorAll(".background-thumb").forEach((button) => button.classList.toggle("selected", button === els.quickBackgroundUpload));
    showManagerNotice("Đã tải hình nền tạm. Ảnh sẽ được nhúng khi lưu JSON.");
  });
  reader.readAsDataURL(file);
}

function resetBackground() {
  if (state.backgroundObjectUrl) URL.revokeObjectURL(state.backgroundObjectUrl);
  state.backgroundObjectUrl = null;
  state.backgroundImageData = "";
  els.backgroundUpload.value = "";
  els.quickBackgroundUpload.style.backgroundImage = "";
  els.quickBackgroundUpload.textContent = "+";
  document.querySelectorAll(".background-thumb").forEach((button) => button.classList.toggle("selected", button.dataset.backgroundPreset === "default"));
  setBackground("");
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
}

els.startButton.addEventListener("click", startGame);
els.createQuestionButton.addEventListener("click", openQuestionCreator);
els.introButton.addEventListener("click", () => playIntro());
els.skipIntroButton.addEventListener("click", () => state.introFinish?.());
els.fullscreenButton.addEventListener("click", toggleFullscreen);
els.settingsButton.addEventListener("click", openManager);
els.endGameButton.addEventListener("click", endGame);
els.finalButton.addEventListener("click", finalAnswer);
els.nextButton.addEventListener("click", nextQuestion);
els.restartButton.addEventListener("click", restartGame);
els.resultRestartButton.addEventListener("click", restartGame);
els.closeHelper.addEventListener("click", closeHelper);
els.helperModal.addEventListener("click", (event) => {
  if (event.target === els.helperModal) closeHelper();
});
els.backToHomeButton.addEventListener("click", closeManager);
els.previewGameButton.addEventListener("click", previewGame);
els.importGameButton.addEventListener("click", () => els.importGameFile.click());
els.importGameFile.addEventListener("change", importGameFile);
els.saveGameButton.addEventListener("click", saveGameFile);
els.applyBackgroundUrl.addEventListener("click", applyBackgroundUrl);
els.backgroundUrl.addEventListener("keydown", (event) => {
  if (event.key === "Enter") applyBackgroundUrl();
});
els.backgroundUpload.addEventListener("change", uploadBackground);
els.resetBackground.addEventListener("click", resetBackground);
els.managerModal.addEventListener("click", (event) => {
  if (event.target === els.managerModal) closeManager();
});
els.managerModal.addEventListener("pointerover", (event) => {
  const target = event.target.closest?.("[data-tooltip]");
  if (target && !target.contains(event.relatedTarget)) showManagerTooltip(target);
});
els.managerModal.addEventListener("pointerout", (event) => {
  const target = event.target.closest?.("[data-tooltip]");
  if (target && !target.contains(event.relatedTarget)) hideManagerTooltip();
});
window.addEventListener("scroll", hideManagerTooltip, true);
document.querySelectorAll("[data-manager-tab]").forEach((button) => {
  button.addEventListener("click", () => setManagerTab(button.dataset.managerTab));
});
document.querySelectorAll(".background-thumb").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.backgroundPreset) applyBackgroundPreset(button.dataset.backgroundPreset);
  });
});
els.quickBackgroundUpload.addEventListener("click", () => els.backgroundUpload.click());
els.questionPackage.addEventListener("change", () => {
  state.selectedClassId = els.questionPackage.value;
  state.selectedQuestionIds = new Set();
  state.importedQuestionIds = Array(15).fill(null);
  state.randomSelectionActive = false;
  renderClassPicker();
  renderQuestionManager();
});
els.cancelQuestionButton.addEventListener("click", renderQuestionManager);
els.questionEditor.addEventListener("submit", saveQuestion);
els.importPickedQuestions.addEventListener("click", importPickedQuestions);
els.randomQuestionsButton.addEventListener("click", chooseRandomQuestions);
els.loadIntoGameButton.addEventListener("click", loadIntoGame);
els.closePackageModal.addEventListener("click", () => {
  els.packageModal.hidden = true;
});
els.packageModal.addEventListener("click", (event) => {
  if (event.target === els.packageModal) els.packageModal.hidden = true;
});
document.querySelectorAll(".lifeline").forEach((button) => {
  button.addEventListener("click", () => useLifeline(button.dataset.lifeline));
});

renderClassPicker();
renderPrizeList();
applyTooltips();
