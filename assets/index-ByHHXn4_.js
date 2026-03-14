(function polyfill() {
  const relList = document.createElement("link").relList;
  if (relList && relList.supports && relList.supports("modulepreload")) return;
  for (const link of document.querySelectorAll('link[rel="modulepreload"]')) processPreload(link);
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== "childList") continue;
      for (const node of mutation.addedNodes) if (node.tagName === "LINK" && node.rel === "modulepreload") processPreload(node);
    }
  }).observe(document, {
    childList: true,
    subtree: true
  });
  function getFetchOpts(link) {
    const fetchOpts = {};
    if (link.integrity) fetchOpts.integrity = link.integrity;
    if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
    if (link.crossOrigin === "use-credentials") fetchOpts.credentials = "include";
    else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
    else fetchOpts.credentials = "same-origin";
    return fetchOpts;
  }
  function processPreload(link) {
    if (link.ep) return;
    link.ep = true;
    const fetchOpts = getFetchOpts(link);
    fetch(link.href, fetchOpts);
  }
})();
const createStore = (initial = {}) => {
  let state = initial;
  const triggers = {};
  return {
    triggers,
    getState: () => state,
    setState: (updated) => {
      state = { ...state, ...updated };
      Object.values(triggers).forEach((trigger) => trigger(state));
    },
    appendTrigger: (key, triggerFn) => triggers[key] = triggerFn,
    hasTrigger: (key) => Boolean(triggers[key])
  };
};
const RANK_RULES = [
  { rank: 1, matchCount: 6, hasBonusNumber: false, prize: 2e9 },
  { rank: 2, matchCount: 5, hasBonusNumber: true, prize: 3e7 },
  { rank: 3, matchCount: 5, hasBonusNumber: false, prize: 15e5 },
  { rank: 4, matchCount: 4, hasBonusNumber: false, prize: 5e4 },
  { rank: 5, matchCount: 3, hasBonusNumber: false, prize: 5e3 }
];
const LottoRankCalculator = {
  calculateLottoRanks(lottos, winningLottoAndBonusNumber) {
    const ranks = RANK_RULES.reduce((prev, cur) => {
      prev[cur.rank] = 0;
      return prev;
    }, {});
    lottos.forEach((lotto) => {
      const rank = winningLottoAndBonusNumber.calculateRank(lotto);
      if (!rank) return;
      ranks[rank] += 1;
    });
    return ranks;
  }
};
const RETURN_AMOUNT_BY_RANK = {
  1: 2e9,
  2: 3e7,
  3: 15e5,
  4: 5e4,
  5: 5e3,
  6: 0
};
const LottoReturnCalculator = {
  calculateReturnAmount(rank) {
    return Object.entries(rank).reduce((sum, [r, c]) => {
      const returnAmount = c * RETURN_AMOUNT_BY_RANK[r];
      return sum + returnAmount;
    }, 0);
  },
  calculateReturnRate(returnAmount, purchaseAmount) {
    return returnAmount / purchaseAmount * 100;
  }
};
const LOTTO = {
  UNIT: 1e3,
  MAX: 45,
  LENGTH: 6
};
const LottoResultGenerator = {
  generateResult(lottos, winningLottoAndBonusNumber) {
    const ranks = LottoRankCalculator.calculateLottoRanks(lottos, winningLottoAndBonusNumber);
    const returnAmount = LottoReturnCalculator.calculateReturnAmount(ranks);
    const returnRate = LottoReturnCalculator.calculateReturnRate(
      returnAmount,
      lottos.length * LOTTO.UNIT
    );
    return { ranks, returnRate };
  }
};
const userLottoStore = createStore({
  purchaseAmount: null,
  lottos: []
});
const winningLottoAndBonusNumberStore = createStore({
  winningLottoAndBonusNumber: null
});
const lottoResultStore = createStore({
  ranks: null,
  returnRate: null
});
const winningNumbersAndBonusNumberFormStore = createStore({
  isValidWinningNumbers: false,
  isValidBonusNumber: false
});
userLottoStore.appendTrigger("winning-lotto-and-bonus-number-store", () => {
  winningLottoAndBonusNumberStore.setState({ winningLottoAndBonusNumber: null });
});
winningLottoAndBonusNumberStore.appendTrigger("lotto-result-store", (state) => {
  const { lottos } = userLottoStore.getState();
  const { winningLottoAndBonusNumber } = state;
  if (lottos.length === 0 || !winningLottoAndBonusNumber) {
    lottoResultStore.setState({ ranks: null, returnRate: null });
    return;
  }
  lottoResultStore.setState(LottoResultGenerator.generateResult(lottos, winningLottoAndBonusNumber));
});
const ERROR_MESSAGE = {
  AMOUNT: {
    UNIT: "구입 금액은 1,000원 단위여야 합니다."
  },
  LOTTO: {
    INTEGER: "로또 번호는 정수여야 합니다.",
    RANGE: "로또 번호는 1부터 45 사이여야 합니다.",
    LENGTH: "로또 번호는 6개여야 합니다.",
    DUPLICATE: "로또 번호는 중복될 수 없습니다."
  },
  BONUS_NUMBER: {
    DUPLICATE: "당첨 번호와 보너스 번호는 중복될 수 없습니다."
  }
};
class LottoNumber {
  #number;
  constructor(number) {
    this.validateNumber(number);
    this.#number = number;
  }
  equals(other) {
    return this.#number === other.valueOf();
  }
  valueOf() {
    return this.#number;
  }
  validateNumber(number) {
    if (!Number.isInteger(number)) {
      throw new Error(ERROR_MESSAGE.LOTTO.INTEGER);
    }
    if (number < 1 || number > 45) {
      throw new Error(ERROR_MESSAGE.LOTTO.RANGE);
    }
  }
}
class Lotto {
  #numbers;
  constructor(numbers) {
    this.validateLotto(numbers);
    const lottoNumbers = numbers.toSorted((a, b) => a - b).map((number) => new LottoNumber(number));
    this.#numbers = lottoNumbers;
  }
  validateLotto(numbers) {
    if (numbers.length !== 6) {
      throw new Error(ERROR_MESSAGE.LOTTO.LENGTH);
    }
    const uniqueNumbers = new Set(numbers);
    if (uniqueNumbers.size !== numbers.length) {
      throw new Error(ERROR_MESSAGE.LOTTO.DUPLICATE);
    }
  }
  getNumbers() {
    return [...this.#numbers];
  }
  parseNumbers() {
    return [...this.#numbers.map(Number)];
  }
  includes(number) {
    return this.#numbers.some((lottoNumber) => lottoNumber.equals(number));
  }
  matchCount(other) {
    const lottoSet = new Set(this.parseNumbers());
    const winningLottoSet = new Set(other.parseNumbers());
    return lottoSet.intersection(winningLottoSet).size;
  }
}
const generateRandomNumber = (max) => {
  return Math.floor(Math.random() * max) + 1;
};
const generateUniqueRandomNumbers = (max, length) => {
  const result = /* @__PURE__ */ new Set();
  while (result.size !== length) {
    const randomNumber = generateRandomNumber(max);
    result.add(randomNumber);
  }
  return Array.from(result);
};
class LottoStore {
  static purchaseLottos(amount) {
    if (amount % LOTTO.UNIT !== 0) {
      throw new Error(ERROR_MESSAGE.AMOUNT.UNIT);
    }
    const lottoCount = amount / LOTTO.UNIT;
    const result = Array.from({ length: lottoCount }).map(
      () => LottoStore.createRandomLotto()
    );
    return result;
  }
  static createRandomLotto() {
    const numbers = generateUniqueRandomNumbers(LOTTO.MAX, LOTTO.LENGTH);
    return new Lotto(numbers);
  }
}
const validatePurchaseAmountInput = (userInput) => {
  if (userInput.trim() === "") {
    throw new Error("구입 금액은 필수 입력값입니다.");
  }
  const amountNumber = Number(userInput);
  if (Number.isNaN(amountNumber) || amountNumber <= 0) {
    throw new Error("구입 금액은 양수여야 합니다.");
  }
};
const validateWinningNumber = (userInput) => {
  if (userInput.trim() === "") {
    throw new Error("당첨 번호는 필수 입력값입니다.");
  }
  const winningNumber = Number(userInput);
  if (Number.isNaN(winningNumber)) {
    throw new Error("당첨 번호는 숫자여야 합니다.");
  }
};
const validateBonusNumber = (userInput) => {
  if (userInput.trim() === "") {
    throw new Error("보너스 번호는 필수 입력값입니다.");
  }
  const bonusNumber = Number(userInput);
  if (Number.isNaN(bonusNumber)) {
    throw new Error("보너스 번호는 숫자여야 합니다.");
  }
};
const PurchaseAmountForm = {
  render(container) {
    this.init();
    if (!userLottoStore.hasTrigger("purchase-amount-form")) {
      userLottoStore.appendTrigger("purchase-amount-form", (state) => {
        if (state.purchaseAmount === null) this.render(container);
      });
    }
    const purchaseAmountForm = document.createElement("form");
    const purchaseAmountCaptionDiv = document.createElement("div");
    const purchaseAmountInputWrapper = document.createElement("div");
    const purchaseAmountInput = document.createElement("input");
    const errorMessageDiv = document.createElement("div");
    const purchaseButton = document.createElement("button");
    purchaseAmountForm.id = "purchase-amount-form";
    purchaseAmountForm.classList.add("purchase-amount-form");
    purchaseAmountForm.addEventListener("submit", this.handleSubmit);
    purchaseAmountCaptionDiv.innerText = "구입할 금액을 입력해주세요.";
    purchaseAmountInputWrapper.classList.add("purchase-amount-input-wrapper");
    purchaseAmountInput.id = "purchase-amount-input";
    purchaseAmountInput.type = "number";
    purchaseAmountInput.name = "purchaseAmount";
    purchaseAmountInput.autofocus = true;
    purchaseAmountInput.addEventListener("input", this.handlePurchaseAmountInput);
    errorMessageDiv.id = "purchase-amount-error-message";
    errorMessageDiv.classList.add("error-message");
    purchaseButton.id = "purchase-button";
    purchaseButton.type = "submit";
    purchaseButton.innerText = "구입";
    purchaseButton.disabled = true;
    purchaseButton.classList.add("button-primary");
    purchaseAmountInputWrapper.appendChild(purchaseAmountInput);
    purchaseAmountInputWrapper.appendChild(purchaseButton);
    purchaseAmountForm.appendChild(purchaseAmountCaptionDiv);
    purchaseAmountForm.appendChild(purchaseAmountInputWrapper);
    purchaseAmountForm.appendChild(errorMessageDiv);
    container.appendChild(purchaseAmountForm);
  },
  handleSubmit(e) {
    e.preventDefault();
    try {
      const formData = new FormData(e.target);
      const { purchaseAmount: purchaseAmountInput } = Object.fromEntries(formData.entries());
      const purchaseAmount = Number(purchaseAmountInput);
      const lottos = LottoStore.purchaseLottos(purchaseAmount);
      userLottoStore.setState({ purchaseAmount, lottos });
    } catch (error) {
      alert(error.message);
    }
  },
  handlePurchaseAmountInput(e) {
    const input = e.target;
    const submitButton = document.getElementById("purchase-button");
    const errorMessageDiv = document.getElementById("purchase-amount-error-message");
    try {
      const purchaseAmount = e.target.value;
      validatePurchaseAmountInput(purchaseAmount);
      input.classList.remove("invalid");
      submitButton.disabled = false;
      errorMessageDiv.innerText = "";
    } catch (e2) {
      input.classList.add("invalid");
      submitButton.disabled = true;
      errorMessageDiv.innerText = e2.message;
    }
  },
  init() {
    const purchaseAmountForm = document.getElementById("purchase-amount-form");
    if (purchaseAmountForm) {
      purchaseAmountForm.remove();
    }
  }
};
const LottoItem = {
  render(container, { lotto }) {
    const lottoItemContainer = document.createElement("li");
    const lottoTicketIcon = document.createElement("img");
    const lottoNumbersContainer = document.createElement("div");
    lottoTicketIcon.src = `./ticket.png`;
    lottoTicketIcon.alt = "";
    lottoNumbersContainer.innerText = lotto.parseNumbers().join(", ");
    lottoItemContainer.appendChild(lottoTicketIcon);
    lottoItemContainer.appendChild(lottoNumbersContainer);
    container.appendChild(lottoItemContainer);
  }
};
const LottoInfo = {
  render(container) {
    this.init();
    if (!userLottoStore.hasTrigger("lotto-info")) {
      userLottoStore.appendTrigger(
        "lotto-info",
        () => this.render(container)
      );
    }
    const { lottos } = userLottoStore.getState();
    if (lottos.length === 0) return;
    const lottoInfoContainer = document.createElement("div");
    const purchaseCountDiv = document.createElement("div");
    const lottoListContainer = document.createElement("ul");
    lottoInfoContainer.id = "lotto-info-container";
    lottoInfoContainer.classList.add("lotto-info-container");
    purchaseCountDiv.innerText = `총 ${lottos.length}개를 구매하였습니다.`;
    lottos.forEach((lotto) => LottoItem.render(lottoListContainer, { lotto }));
    lottoInfoContainer.appendChild(purchaseCountDiv);
    lottoInfoContainer.appendChild(lottoListContainer);
    container.appendChild(lottoInfoContainer);
  },
  init() {
    const lottoInfoContainer = document.getElementById("lotto-info-container");
    if (lottoInfoContainer) {
      lottoInfoContainer.remove();
    }
  }
};
class WinningLottoAndBonusNumber {
  #winningLotto;
  #bonusNumber;
  constructor(winningLotto, bonusNumber) {
    this.#winningLotto = winningLotto;
    this.validateBonusNumber(bonusNumber);
    this.#bonusNumber = new LottoNumber(bonusNumber);
  }
  validateBonusNumber(bonusNumber) {
    if (this.#winningLotto.includes(bonusNumber)) {
      throw new Error(ERROR_MESSAGE.BONUS_NUMBER.DUPLICATE);
    }
  }
  calculateRank(userLotto) {
    const matchCount = userLotto.matchCount(this.#winningLotto);
    const hasBonusNumber = userLotto.includes(this.#bonusNumber);
    return RANK_RULES.find((rule) => {
      if (rule.hasBonusNumber) {
        return matchCount === rule.matchCount && hasBonusNumber;
      }
      return matchCount === rule.matchCount;
    })?.rank;
  }
}
const WinningNumbersAndBonusNumberForm = {
  render(container) {
    this.init();
    if (!userLottoStore.hasTrigger("winning-numbers-and-bonus-number-form")) {
      userLottoStore.appendTrigger(
        "winning-numbers-and-bonus-number-form",
        () => this.render(container)
      );
    }
    if (!userLottoStore.getState().purchaseAmount) return;
    const winningLottoAndBonusNumberForm = document.createElement("form");
    const descriptionDiv = document.createElement("div");
    const winningLottoAndBonusNumberWrapper = document.createElement("div");
    const winningNumbersWrapper = document.createElement("div");
    const winningNumbersCaption = document.createElement("div");
    const winningNumbersInputWrapper = document.createElement("div");
    const winningNumberInputs = this.createWinningNumberInputs();
    const bonusNumberWrapper = document.createElement("div");
    const bonusNumberCaption = document.createElement("label");
    const bonusNumberInput = document.createElement("input");
    const errorMessageDiv = document.createElement("div");
    const resultCheckButton = document.createElement("button");
    winningLottoAndBonusNumberForm.id = "winning-lotto-and-bonus-number-form";
    winningLottoAndBonusNumberForm.classList.add("winning-lotto-and-bonus-number-form");
    winningLottoAndBonusNumberForm.addEventListener("submit", this.handleSubmit);
    descriptionDiv.innerText = "지난 주 당첨번호 6개와 보너스 번호 1개를 입력해주세요.";
    winningLottoAndBonusNumberWrapper.classList.add("winning-numbers-and-bonus-number-wrapper");
    winningNumbersWrapper.classList.add("winning-numbers-wrapper");
    winningNumbersInputWrapper.classList.add("winning-numbers-input-wrapper");
    bonusNumberWrapper.classList.add("bonus-number-wrapper");
    winningNumbersCaption.innerText = "당첨 번호";
    bonusNumberCaption.innerText = "보너스 번호";
    bonusNumberCaption.htmlFor = "bonus-number-input";
    bonusNumberInput.id = "bonus-number-input";
    bonusNumberInput.type = "number";
    bonusNumberInput.name = "bonusNumber";
    bonusNumberInput.addEventListener("input", this.handleBonusNumberInput);
    bonusNumberInput.addEventListener("keydown", this.handleKeydown);
    errorMessageDiv.id = "winning-numbers-and-bonus-number-error-message";
    errorMessageDiv.classList.add("error-message");
    resultCheckButton.id = "result-check-button";
    resultCheckButton.type = "submit";
    resultCheckButton.innerText = "결과 확인하기";
    resultCheckButton.disabled = true;
    resultCheckButton.classList.add("button-primary", "result-check-button");
    winningNumberInputs.forEach((input) => winningNumbersInputWrapper.appendChild(input));
    winningNumbersWrapper.appendChild(winningNumbersCaption);
    winningNumbersWrapper.appendChild(winningNumbersInputWrapper);
    bonusNumberWrapper.appendChild(bonusNumberCaption);
    bonusNumberWrapper.appendChild(bonusNumberInput);
    winningLottoAndBonusNumberWrapper.appendChild(winningNumbersWrapper);
    winningLottoAndBonusNumberWrapper.appendChild(bonusNumberWrapper);
    winningLottoAndBonusNumberForm.appendChild(descriptionDiv);
    winningLottoAndBonusNumberForm.appendChild(winningLottoAndBonusNumberWrapper);
    winningLottoAndBonusNumberForm.appendChild(errorMessageDiv);
    winningLottoAndBonusNumberForm.appendChild(resultCheckButton);
    container.appendChild(winningLottoAndBonusNumberForm);
  },
  handleSubmit(e) {
    e.preventDefault();
    try {
      const formData = new FormData(e.target);
      const { winningNumber1, winningNumber2, winningNumber3, winningNumber4, winningNumber5, winningNumber6, bonusNumber } = Object.fromEntries(formData.entries());
      const winningNumbers = [winningNumber1, winningNumber2, winningNumber3, winningNumber4, winningNumber5, winningNumber6].map(Number);
      const winningLottoAndBonusNumber = new WinningLottoAndBonusNumber(new Lotto(winningNumbers), Number(bonusNumber));
      winningLottoAndBonusNumberStore.setState({ winningLottoAndBonusNumber });
    } catch (error) {
      alert(error.message);
    }
  },
  createWinningNumberInputs() {
    return Array.from({ length: 6 }).map((_, i) => {
      const input = document.createElement("input");
      input.id = `winning-number-input-${i + 1}`;
      input.type = "number";
      input.name = `winningNumber${i + 1}`;
      input.ariaLabel = `${i + 1}번째 당첨 번호`;
      input.classList.add("winning-number-input");
      input.addEventListener("input", this.handleWinningNumberInput);
      input.addEventListener("keydown", this.handleKeydown);
      return input;
    });
  },
  handleWinningNumberInput(e) {
    const inputWrapper = e.target.parentElement;
    const submitButton = document.getElementById("result-check-button");
    const errorMessageDiv = document.getElementById("winning-numbers-and-bonus-number-error-message");
    try {
      const winningNumberInputs = document.querySelectorAll(".winning-number-input");
      const winningNumbers = [...winningNumberInputs].map((input) => input.value);
      winningNumbers.forEach((number) => validateWinningNumber(number));
      winningNumbersAndBonusNumberFormStore.setState({ isValidWinningNumbers: true });
      const { isValidBonusNumber } = winningNumbersAndBonusNumberFormStore.getState();
      if (isValidBonusNumber) {
        submitButton.disabled = false;
      }
      errorMessageDiv.innerText = "";
      inputWrapper.classList.remove("invalid");
    } catch (e2) {
      winningNumbersAndBonusNumberFormStore.setState({ isValidWinningNumbers: false });
      submitButton.disabled = true;
      errorMessageDiv.innerText = e2.message;
      inputWrapper.classList.add("invalid");
    }
  },
  handleBonusNumberInput(e) {
    const input = e.target;
    const submitButton = document.getElementById("result-check-button");
    const errorMessageDiv = document.getElementById("winning-numbers-and-bonus-number-error-message");
    try {
      const bonusNumber = e.target.value;
      validateBonusNumber(bonusNumber);
      winningNumbersAndBonusNumberFormStore.setState({ isValidBonusNumber: true });
      const { isValidWinningNumbers } = winningNumbersAndBonusNumberFormStore.getState();
      if (isValidWinningNumbers) {
        submitButton.disabled = false;
      }
      errorMessageDiv.innerText = "";
      input.classList.remove("invalid");
    } catch (e2) {
      winningNumbersAndBonusNumberFormStore.setState({ isValidBonusNumber: false });
      submitButton.disabled = true;
      errorMessageDiv.innerText = e2.message;
      input.classList.add("invalid");
    }
  },
  handleKeydown(e) {
    const inputs = document.querySelectorAll(":scope #winning-lotto-and-bonus-number-form input");
    if (e.key === "ArrowLeft") {
      inputs.forEach((input, i) => {
        if (input === e.target) {
          inputs[i - 1]?.focus();
        }
      });
    }
    if (e.key === "ArrowRight") {
      inputs.forEach((input, i) => {
        if (input === e.target) {
          inputs[i + 1]?.focus();
        }
      });
    }
  },
  init() {
    const winningLottoAndBonusNumberForm = document.getElementById("winning-lotto-and-bonus-number-form");
    if (winningLottoAndBonusNumberForm) {
      winningLottoAndBonusNumberForm.remove();
    }
  }
};
const LottoGameCard = {
  render(container) {
    const lottoGameCard = document.createElement("main");
    const lottoGameCardHeader = document.createElement("header");
    lottoGameCard.id = "lotto-game-card";
    lottoGameCard.classList.add("lotto-game-card");
    lottoGameCardHeader.innerText = "🎱 내 번호 당첨 확인 🎱";
    lottoGameCardHeader.classList.add("text-lotto-title");
    lottoGameCard.appendChild(lottoGameCardHeader);
    PurchaseAmountForm.render(lottoGameCard);
    LottoInfo.render(lottoGameCard);
    WinningNumbersAndBonusNumberForm.render(lottoGameCard);
    container.appendChild(lottoGameCard);
  }
};
const Modal = {
  render(container, { children }) {
    const modalWrapper = document.createElement("div");
    const modalContainer = document.createElement("div");
    const closeButton = document.createElement("button");
    const closeButtonIcon = document.createElement("img");
    modalWrapper.id = "modal-wrapper";
    modalWrapper.classList.add("modal-wrapper");
    modalWrapper.addEventListener("click", this.handleOutsideClick);
    modalContainer.id = "modal-container";
    closeButton.classList.add("close-button");
    closeButton.addEventListener("click", this.handleClose);
    closeButtonIcon.src = "./close.svg";
    closeButtonIcon.alt = "닫기";
    closeButton.appendChild(closeButtonIcon);
    modalContainer.appendChild(closeButton);
    modalContainer.appendChild(children);
    modalWrapper.appendChild(modalContainer);
    container.appendChild(modalWrapper);
  },
  handleOutsideClick(e) {
    if (!e.target.closest("#modal-container")) {
      e.target.remove();
    }
  },
  handleClose() {
    const modalWrapper = document.querySelector("#modal-wrapper");
    if (modalWrapper) {
      modalWrapper.remove();
    }
  }
};
const LottoRanksTable = {
  render(container, { ranks }) {
    const table = document.createElement("table");
    const caption = document.createElement("caption");
    const thead = document.createElement("thead");
    const tr = document.createElement("tr");
    const tbody = document.createElement("tbody");
    const ths = this.createThs();
    const bodyRows = this.createBodyRows(ranks);
    table.id = "lotto-ranks-table";
    table.classList.add("lotto-ranks-table");
    caption.innerText = "🏆 당첨 통계 🏆";
    caption.classList.add("text-lotto-subtitle");
    ths.forEach((th) => tr.appendChild(th));
    thead.appendChild(tr);
    bodyRows.forEach((row) => tbody.appendChild(row));
    table.appendChild(caption);
    table.appendChild(thead);
    table.appendChild(tbody);
    container.appendChild(table);
  },
  createThs() {
    return ["일치 갯수", "당첨금", "당첨 갯수"].map((header) => {
      const th = document.createElement("th");
      th.innerText = header;
      th.scope = "col";
      return th;
    });
  },
  createBodyRows(ranks) {
    return RANK_RULES.map((rule) => {
      const tr = document.createElement("tr");
      const td1 = document.createElement("td");
      const td2 = document.createElement("td");
      const td3 = document.createElement("td");
      const bonusNumberText = rule.hasBonusNumber ? "+보너스볼" : "";
      td1.innerText = `${rule.matchCount}개${bonusNumberText}`;
      td2.innerText = rule.prize.toLocaleString();
      td3.innerText = `${ranks[rule.rank]}개`;
      tr.appendChild(td1);
      tr.appendChild(td2);
      tr.appendChild(td3);
      return tr;
    }).reverse();
  }
};
const LottoResult = {
  render(container) {
    const { ranks, returnRate } = lottoResultStore.getState();
    const lottoResultContainer = document.createElement("div");
    const returnRateDiv = document.createElement("div");
    lottoResultContainer.id = "lotto-result-container";
    returnRateDiv.innerText = `당신의 총 수익률은 ${returnRate.toFixed(1)}%입니다.`;
    returnRateDiv.classList.add("return-rate");
    LottoRanksTable.render(lottoResultContainer, { ranks });
    lottoResultContainer.appendChild(returnRateDiv);
    container.appendChild(lottoResultContainer);
  }
};
const LottoResultModal = {
  render(container) {
    if (!lottoResultStore.hasTrigger("lotto-result-modal")) {
      lottoResultStore.appendTrigger("lotto-result-modal", () => this.render(container));
    }
    if (!lottoResultStore.getState().ranks) return;
    const lottoResultModalContent = document.createElement("div");
    const retryButton = document.createElement("button");
    lottoResultModalContent.classList.add("lotto-result-modal-content");
    retryButton.innerText = "다시 시작하기";
    retryButton.classList.add("button-primary");
    retryButton.addEventListener("click", this.handleRetryClick);
    LottoResult.render(lottoResultModalContent);
    lottoResultModalContent.appendChild(retryButton);
    Modal.render(container, { children: lottoResultModalContent });
  },
  handleRetryClick() {
    userLottoStore.setState({ purchaseAmount: null, lottos: [] });
    const modalWrapper = document.querySelector(".modal-wrapper");
    if (modalWrapper) {
      modalWrapper.remove();
    }
  }
};
const LottoHeader = {
  render(container) {
    const header = document.createElement("header");
    const h1 = document.createElement("h1");
    header.classList.add("lotto-header");
    h1.innerText = "🎱 행운의 로또";
    h1.classList.add("text-lotto-title");
    header.appendChild(h1);
    container.appendChild(header);
  }
};
const LottoFooter = {
  render(container) {
    const footer = document.createElement("footer");
    footer.innerText = "Copyright 2023. woowacourse";
    footer.classList.add("lotto-footer", "text-lotto-caption");
    container.appendChild(footer);
  }
};
function main() {
  const app = document.getElementById("app");
  LottoHeader.render(app);
  LottoGameCard.render(app);
  LottoFooter.render(app);
  LottoResultModal.render(app);
}
main();
