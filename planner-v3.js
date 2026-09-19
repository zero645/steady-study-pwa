(function (root, factory) {
  const curriculum = typeof module === "object" && module.exports
    ? require("./curriculum.js")
    : root.StudyCurriculum;
  const api = factory(curriculum);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.StudyPlannerV3 = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (curriculum) {
  "use strict";

  if (!Array.isArray(curriculum) || !curriculum.length) {
    throw new Error("Study curriculum is unavailable.");
  }

  const MODES = {
    rescue: { label: "5 分钟急救", minutes: 5, taskLimit: 1 },
    minimum: { label: "保底", minutes: 15, taskLimit: 1 },
    standard: { label: "正常", minutes: 50, taskLimit: 2 },
    full: { label: "充足", minutes: 80, taskLimit: 3 }
  };

  const SUBJECT_META = {
    "英语": { key: "english", short: "英语" },
    "高等数学": { key: "math", short: "高数" },
    "计算机基础": { key: "computer", short: "计算机" },
    "大学语文": { key: "chinese", short: "语文" }
  };

  const STARTER_ENGLISH = ["E1-01", "E1-03", "E2-01", "E2-02", "E1-05", "E2-03"];
  const STARTER_MAIN = ["M1-01", "C1-01", "M1-02", "Y2-01", "C1-04", "M1-03"];
  const MAIN_ROTATION = ["高等数学", "计算机基础", "高等数学", "大学语文", "计算机基础", "高等数学"];

  const POINT_DETAILS = {
    "E1-01": {
      search: "专升本英语 高频核心词 主动回忆 词义用法",
      goals: ["遮住释义回忆单词含义", "能在简单句中辨认词义和词性"]
    },
    "E1-03": {
      search: "专升本英语 句子成分 主谓宾定状补 简单句",
      goals: ["找出简单句的主语和谓语", "区分宾语、表语和宾语补足语"]
    },
    "E2-01": {
      search: "专升本英语 阅读理解 细节题 信息定位",
      goals: ["根据题干关键词定位原文", "用原文证据排除干扰项"]
    },
    "E2-02": {
      search: "专升本英语 阅读理解 指代题 pronoun reference",
      goals: ["向前寻找代词可能指向的名词", "用单复数和语义验证指代关系"]
    },
    "E1-05": {
      search: "专升本英语 时态 语态 主谓一致 基础",
      goals: ["根据时间标志判断基本时态", "区分主动语态和被动语态"]
    },
    "E2-03": {
      search: "专升本英语 阅读理解 猜词题 语境线索",
      goals: ["利用同义、反义和解释线索猜词", "把推测词义放回原句验证"]
    },
    "M1-01": {
      search: "高等数学一 函数概念 定义域 函数值 基础题",
      goals: ["会求分式、根式等常见函数定义域", "能按函数表达式计算函数值"]
    },
    "M1-02": {
      search: "高等数学一 函数 有界性 单调性 奇偶性 周期性",
      goals: ["能判断常见函数的奇偶性", "能从图像或定义判断单调性和有界性"]
    },
    "M1-03": {
      search: "高等数学一 分段函数 复合函数 反函数 基础",
      goals: ["会按区间计算分段函数值", "会求简单复合函数和反函数"]
    },
    "C1-01": {
      search: "山东专升本计算机 数据 信息 信息技术 信息社会",
      goals: ["区分数据与信息", "理解信息技术和信息社会的基本含义"]
    },
    "C1-04": {
      search: "山东专升本计算机 二进制 八进制 十六进制 转换",
      goals: ["会把二进制转换为十进制", "会在十进制与二、八、十六进制间转换"]
    },
    "Y2-01": {
      search: "专升本大学语文 文言实词 单音词 烛之武退秦师",
      goals: ["结合语境解释常见文言实词", "识别古今词义差异"]
    }
  };

  const QUIZ_BANK = {
    "E1-01": [
      q("achieve 最接近哪一个意思？", ["减少", "达到、实现", "拒绝", "比较"], 1, "achieve 表示“达到、实现”，常与 goal、success 搭配。"),
      q("require 最接近哪一个意思？", ["需要、要求", "提供", "避免", "允许"], 0, "require 表示“需要、要求”。"),
      q("increase 的反义词是？", ["improve", "include", "reduce", "repeat"], 2, "increase 是增加，reduce 是减少。"),
      q("necessary 的词性通常是？", ["名词", "动词", "形容词", "副词"], 2, "necessary 是形容词，表示“必要的”。"),
      q("The job ___ patience. 应填入？", ["requires", "reduces", "reaches", "remembers"], 0, "句意是“这份工作需要耐心”，主语为第三人称单数。")
    ],
    "E1-03": [
      q("She studies English every day. 句子的主语是？", ["She", "studies", "English", "every day"], 0, "She 是动作 studies 的发出者。"),
      q("She studies English every day. 句子的谓语是？", ["She", "studies", "English", "every day"], 1, "studies 是句子的核心谓语动词。"),
      q("The news made him happy. happy 充当什么成分？", ["主语", "宾语", "宾语补足语", "定语"], 2, "happy 补充说明宾语 him 的状态。"),
      q("He is a student. a student 充当什么成分？", ["表语", "状语", "定语", "谓语"], 0, "系动词 is 后面的 a student 是表语。"),
      q("哪一个是并列句？", ["Open the door.", "I came, but he left.", "The boy in blue is Tom.", "Reading is useful."], 1, "两个独立分句由 but 连接，构成并列句。")
    ],
    "E2-01": [
      q("短文：The library opens at 8:00 on weekdays and at 9:00 on weekends. 周六几点开放？", ["7:00", "8:00", "9:00", "10:00"], 2, "weekends 对应周末，原文明确写 9:00。"),
      q("短文：Students may borrow four books for two weeks. 最多借几本？", ["2", "4", "7", "14"], 1, "four books 是借阅数量。"),
      q("短文：Tom takes the bus because his school is far from home. Tom 为什么坐公交？", ["公交便宜", "学校离家远", "他不会骑车", "天气不好"], 1, "because 后面直接给出原因。"),
      q("做细节题时，第一步更合适的是？", ["通篇翻译", "看题干关键词", "只看首句", "凭印象选"], 1, "先提取题干关键词，再回原文定位，效率更高。"),
      q("定位到原文后，选择答案最可靠的依据是？", ["选项最长", "熟悉的单词", "原文证据", "个人经验"], 2, "阅读答案必须由原文支持。")
    ],
    "E2-02": [
      q("Mary called Lily because she needed help. 若上下文说明 Mary 遇到困难，she 指谁？", ["Mary", "Lily", "help", "无法判断"], 0, "上下文语义说明需要帮助的是 Mary。"),
      q("The books are useful. They are on the desk. They 指什么？", ["useful", "desk", "books", "the"], 2, "复数代词 They 与复数名词 books 一致。"),
      q("Tom bought a phone, but it was expensive. it 指什么？", ["Tom", "phone", "money", "shop"], 1, "单数中性代词 it 指代 phone。"),
      q("判断代词指代时，应优先检查什么？", ["字体大小", "前文名词及单复数", "句子长度", "标点数量"], 1, "先找前文候选名词，再核对单复数和语义。"),
      q("This problem is difficult, and this worries me. 第二个 this 指什么？", ["我", "problem 这个词", "问题很难这件事", "difficult 的反义词"], 2, "this 可以指代前面整个事实。")
    ],
    "E1-05": [
      q("She ___ to school every day.", ["go", "goes", "went", "going"], 1, "every day 表示一般现在时，she 后用 goes。"),
      q("They ___ the work yesterday.", ["finish", "finished", "will finish", "are finishing"], 1, "yesterday 是一般过去时标志。"),
      q("The bridge ___ in 2020.", ["builds", "built", "was built", "is building"], 2, "桥是被建造的，且发生在过去，用 was built。"),
      q("Neither Tom nor his friends ___ ready.", ["is", "are", "was", "be"], 1, "就近一致，friends 为复数，因此用 are。"),
      q("Look! The children ___ football.", ["play", "played", "are playing", "have played"], 2, "Look 提示动作正在发生，用现在进行时。")
    ],
    "E2-03": [
      q("The road was slippery, so drivers moved slowly. slippery 最可能是？", ["宽阔的", "湿滑的", "拥挤的", "笔直的"], 1, "司机因此慢行，说明道路湿滑。"),
      q("Unlike his noisy brother, Ben is quiet. quiet 的判断线索是？", ["因果", "反义对比", "举例", "数字"], 1, "Unlike 表示对比，noisy 与 quiet 相反。"),
      q("A botanist, a scientist who studies plants, visited us. botanist 是？", ["研究植物的科学家", "医生", "司机", "作家"], 0, "逗号后的同位解释直接给出词义。"),
      q("猜出词义后，下一步应该？", ["立即作答", "放回原句验证", "查所有选项", "忽略上下文"], 1, "把推测含义代回原句，检查语义是否通顺。"),
      q("The room was tiny; only one chair could fit. tiny 最接近？", ["明亮的", "很小的", "整洁的", "昂贵的"], 1, "只能放下一把椅子，说明房间很小。")
    ],
    "M1-01": [
      q("函数 f(x)=1/(x-2) 的定义域是？", ["x>2", "x<2", "x≠2", "全体实数"], 2, "分母不能为 0，因此 x≠2。"),
      q("函数 f(x)=√(x+1) 的定义域是？", ["x≥-1", "x>-1", "x≤-1", "全体实数"], 0, "偶次根式内必须非负：x+1≥0。"),
      q("若 f(x)=2x+3，则 f(2)=？", ["4", "5", "7", "9"], 2, "代入 x=2，得到 2×2+3=7。"),
      q("函数 f(x)=1/√(x-1) 的定义域是？", ["x≥1", "x>1", "x≠1", "x<1"], 1, "根式要有意义且分母不能为 0，所以 x-1>0。"),
      q("判断两个变量是否构成函数关系，关键是？", ["每个 x 只能对应一个 y", "每个 y 只能对应一个 x", "x 和 y 必须相等", "必须有解析式"], 0, "函数要求定义域内每个 x 有且只有一个对应值 y。")
    ],
    "M1-02": [
      q("f(x)=x² 是什么函数？", ["奇函数", "偶函数", "非奇非偶", "周期函数"], 1, "f(-x)=(-x)²=x²=f(x)，所以是偶函数。"),
      q("f(x)=x³ 是什么函数？", ["奇函数", "偶函数", "常函数", "无界但非奇函数"], 0, "f(-x)=-x³=-f(x)，所以是奇函数。"),
      q("函数 f(x)=2x+1 在实数范围内？", ["单调递增", "单调递减", "先增后减", "有界"], 0, "一次函数斜率 2>0，因此单调递增。"),
      q("函数 sin x 的一个正周期是？", ["π/2", "π", "2π", "4π"], 2, "sin(x+2π)=sin x。"),
      q("函数 f(x)=1/(1+x²) 在实数范围内是否有界？", ["无界", "有界", "只上方无界", "无法判断"], 1, "0<f(x)≤1，因此有界。")
    ],
    "M1-03": [
      q("f(x)={x+1(x≥0), -x(x<0)}，则 f(-2)=？", ["-2", "-1", "1", "2"], 3, "-2<0，使用 -x，得到 2。"),
      q("f(x)=2x，g(x)=x+1，则 f(g(x))=？", ["2x+1", "2x+2", "x+3", "2x"], 1, "先算 g(x)=x+1，再代入 f，得 2(x+1)。"),
      q("f(x)=x+3 的反函数是？", ["x-3", "x+3", "3-x", "1/(x+3)"], 0, "交换 x、y 后解出 y=x-3。"),
      q("求复合函数时，正确顺序是？", ["先算外层再算内层", "先算内层再代入外层", "两层同时算", "只看外层"], 1, "f(g(x)) 要先确定 g(x)，再代入 f。"),
      q("分段函数求值首先要做什么？", ["求导", "判断自变量所在区间", "画坐标轴", "通分"], 1, "先判断输入值落在哪个区间，再选对应表达式。")
    ],
    "C1-01": [
      q("未经加工的数字、文字、符号通常称为？", ["知识", "数据", "信息社会", "程序"], 1, "数据是信息的载体和原始表现形式。"),
      q("数据经过处理并具有意义后通常称为？", ["信息", "硬件", "噪声", "算法"], 0, "信息是经过处理、对接收者有意义的数据。"),
      q("下列哪项属于信息技术应用？", ["纸张折叠", "在线检索课程资料", "手工削铅笔", "整理书桌"], 1, "信息检索、传输和处理属于信息技术应用。"),
      q("信息社会的重要特征之一是？", ["不再需要数据", "信息成为重要资源", "只有纸质通信", "计算机停止发展"], 1, "信息和知识成为重要生产资源。"),
      q("同一组数据对不同人价值不同，主要说明信息具有？", ["绝对性", "价值相对性", "不可传递性", "无限存储性"], 1, "信息价值会随使用者、时间和场景变化。")
    ],
    "C1-04": [
      q("二进制 1010 等于十进制？", ["8", "10", "12", "16"], 1, "1×8+0×4+1×2+0×1=10。"),
      q("十进制 15 等于十六进制？", ["E", "F", "10", "1F"], 1, "十六进制用 F 表示十进制 15。"),
      q("八进制 10 等于十进制？", ["2", "8", "10", "16"], 1, "八进制 10 表示 1×8。"),
      q("二进制 1111 等于十六进制？", ["A", "E", "F", "10"], 2, "四位二进制 1111 对应十六进制 F。"),
      q("十进制 8 等于二进制？", ["1000", "1001", "1010", "1111"], 0, "8=2³，因此写作 1000₂。")
    ],
    "Y2-01": [
      q("《烛之武退秦师》中“辞曰”的“辞”意思是？", ["言辞", "推辞", "辞别", "文体"], 1, "这里是烛之武推辞说。"),
      q("“越国以鄙远”中的“鄙”在句中是？", ["轻视", "边邑", "把……当作边邑", "粗俗"], 2, "鄙在这里是意动/使动色彩的活用：把远地作为边邑。"),
      q("“微夫人之力不及此”中的“微”意思是？", ["微小", "稍微", "如果没有", "隐藏"], 2, "微用于假设，表示“如果没有”。"),
      q("古文中“行李之往来”的“行李”意思是？", ["出行携带的物品", "外交使者", "旅行", "道路"], 1, "这里的行李是古今异义，指外交使者。"),
      q("理解文言实词最可靠的方法是？", ["只背现代词义", "结合语境和句法", "只看字形", "按读音猜"], 1, "实词含义需要结合上下文和句子结构判断。")
    ]
  };

  function q(prompt, options, answer, explanation) {
    return { prompt, options, answer, explanation };
  }

  function makeId(prefix) {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return prefix + "-" + crypto.randomUUID();
    return prefix + "-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  }

  function toDate(key) {
    const parts = key.split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
  }

  function dateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function addDays(key, amount) {
    const date = toDate(key);
    date.setDate(date.getDate() + amount);
    return dateKey(date);
  }

  function pointByCode(code) {
    return curriculum.find((point) => point.code === code) || null;
  }

  function defaultGoals(subject) {
    if (subject === "高等数学") return ["能用自己的话说明核心概念", "完成至少 5 道基础题并记录正确数"];
    if (subject === "英语") return ["能识别该知识点在句子或短文中的表现", "完成至少 5 道基础题并核对原因"];
    if (subject === "计算机基础") return ["能区分本知识点的关键概念", "完成至少 5 道判断或选择题"];
    return ["能说出本知识点的核心内容", "完成至少 5 道识记或理解题"];
  }

  function enrichPoint(point) {
    if (!point) return null;
    const details = POINT_DETAILS[point.code] || {};
    return {
      ...point,
      search: details.search || ("山东专升本 " + point.subject + " " + point.title + " 基础讲解 练习题"),
      goals: details.goals || defaultGoals(point.subject),
      hasBuiltInQuiz: Boolean(QUIZ_BANK[point.code])
    };
  }

  function questionsFor(code, limit) {
    const questions = QUIZ_BANK[code] || [];
    return questions.slice(0, Number(limit) || questions.length).map((item) => ({
      ...item,
      options: [...item.options]
    }));
  }

  function createInitialState(today) {
    return {
      version: 3,
      profile: {
        examName: "2027 山东专升本",
        baseline: "2026 官方考试要求",
        defaultMode: "minimum",
        weakSubject: "英语"
      },
      days: {},
      progress: {},
      history: [],
      preferences: { lastBackupAt: null },
      createdAt: today
    };
  }

  function migrateStore(raw, today) {
    const base = createInitialState(today);
    if (!raw || typeof raw !== "object") return base;
    if (raw.version === 3) {
      return {
        ...base,
        ...raw,
        profile: { ...base.profile, ...(raw.profile || {}) },
        days: raw.days && typeof raw.days === "object" ? raw.days : {},
        progress: raw.progress && typeof raw.progress === "object" ? raw.progress : {},
        history: Array.isArray(raw.history) ? raw.history : [],
        preferences: { ...base.preferences, ...(raw.preferences || {}) }
      };
    }

    const legacyMap = {
      "math-functions": "M1-01",
      "math-limit-concept": "M1-05",
      "math-limit-calc": "M1-06",
      "math-two-limits": "M1-07",
      "math-infinitesimal": "M1-08",
      "math-continuity": "M1-10",
      "math-derivative": "M2-01",
      "math-rules": "M2-03",
      "math-composite": "M2-04",
      "math-differential": "M2-07",
      "computer-origin": "C1-02",
      "computer-types": "C1-02",
      "computer-bases-1": "C1-04",
      "computer-bases-2": "C1-04",
      "computer-binary": "C1-05",
      "computer-units": "C1-05",
      "chinese-pre-qin": "Y1-01",
      "chinese-recall": "Y1-01"
    };
    Object.entries(raw.progress || {}).forEach(([oldCode, value]) => {
      const code = legacyMap[oldCode];
      if (!code) return;
      base.progress[code] = {
        attempts: value.introduced ? 1 : 0,
        passes: Number(value.mastery || 0) >= 60 ? 1 : 0,
        bestScore: Number(value.mastery || 0),
        lastScore: Number(value.mastery || 0),
        nextReview: value.nextReview || null,
        lastStudied: value.lastStudied || null
      };
    });
    base.legacy = { importedVersion: raw.version || 1, importedAt: today };
    return base;
  }

  function hasAttempted(state, code) {
    return Number(state.progress[code]?.attempts || 0) > 0;
  }

  function nextFromOrder(state, codes, excluded) {
    const blocked = new Set(excluded || []);
    return codes.map(pointByCode).find((point) => point && !blocked.has(point.code) && !hasAttempted(state, point.code)) || null;
  }

  function nextEnglishPoint(state, excluded) {
    const starter = nextFromOrder(state, STARTER_ENGLISH, excluded);
    if (starter) return starter;
    const codes = curriculum.filter((point) => point.subject === "英语").map((point) => point.code);
    return nextFromOrder(state, codes, excluded) || pointByCode(codes[0]);
  }

  function nextMainPoint(state, excluded) {
    const starter = nextFromOrder(state, STARTER_MAIN, excluded);
    if (starter) return starter;
    const completedMain = state.history.filter((entry) => entry.kind === "learn" && entry.subject !== "英语").length;
    const subject = MAIN_ROTATION[completedMain % MAIN_ROTATION.length];
    const codes = curriculum.filter((point) => point.subject === subject).map((point) => point.code);
    return nextFromOrder(state, codes, excluded) || pointByCode(codes[0]);
  }

  function duePoints(state, key) {
    return curriculum
      .filter((point) => state.progress[point.code]?.nextReview && state.progress[point.code].nextReview <= key)
      .sort((a, b) => state.progress[a.code].nextReview.localeCompare(state.progress[b.code].nextReview));
  }

  function taskFromPoint(point, options) {
    const enriched = enrichPoint(point);
    return {
      id: makeId("task"),
      knowledgeId: point.code,
      subject: point.subject,
      title: point.title,
      search: enriched.search,
      goals: enriched.goals,
      hasBuiltInQuiz: enriched.hasBuiltInQuiz,
      duration: options.duration,
      kind: options.kind || "learn",
      phase: "ready",
      quizLimit: options.quizLimit || 5,
      completed: false,
      startedAt: null,
      completedAt: null,
      result: null
    };
  }

  function generateDailyPlan(state, key, requestedMode) {
    const mode = MODES[requestedMode] ? requestedMode : state.profile.defaultMode;
    const due = duePoints(state, key);
    const tasks = [];
    const used = new Set();

    function add(point, options) {
      if (!point || used.has(point.code)) return;
      tasks.push(taskFromPoint(point, options));
      used.add(point.code);
    }

    if (mode === "rescue") {
      add(due[0] || nextEnglishPoint(state), { duration: 5, kind: due[0] ? "review" : "learn", quizLimit: 2 });
    } else if (mode === "minimum") {
      const dueEnglish = due.find((point) => point.subject === "英语");
      add(dueEnglish || nextEnglishPoint(state), { duration: 15, kind: dueEnglish ? "review" : "learn", quizLimit: 5 });
    } else if (mode === "standard") {
      const dueEnglish = due.find((point) => point.subject === "英语");
      add(dueEnglish || nextEnglishPoint(state), { duration: 20, kind: dueEnglish ? "review" : "learn", quizLimit: 5 });
      const dueMain = due.find((point) => point.subject !== "英语");
      add(dueMain || nextMainPoint(state, used), { duration: 30, kind: dueMain ? "review" : "learn", quizLimit: 5 });
    } else {
      const dueEnglish = due.find((point) => point.subject === "英语");
      add(dueEnglish || nextEnglishPoint(state), { duration: 20, kind: dueEnglish ? "review" : "learn", quizLimit: 5 });
      const dueMain = due.find((point) => !used.has(point.code));
      if (dueMain) add(dueMain, { duration: 20, kind: "review", quizLimit: 5 });
      add(nextMainPoint(state, used), { duration: dueMain ? 35 : 40, kind: "learn", quizLimit: 5 });
      if (tasks.length < 3) {
        const firstMain = tasks.find((task) => task.subject !== "英语");
        const extra = curriculum.find((point) =>
          point.subject === (firstMain?.subject || "高等数学") &&
          !used.has(point.code) &&
          !hasAttempted(state, point.code)
        );
        add(extra, { duration: 20, kind: "learn", quizLimit: 5 });
      }
    }

    return { key, mode, tasks: tasks.slice(0, MODES[mode].taskLimit), createdAt: new Date().toISOString() };
  }

  function ensureDay(state, key, mode) {
    if (!state.days[key]) state.days[key] = generateDailyPlan(state, key, mode);
    return state.days[key];
  }

  function setDayMode(state, key, mode) {
    if (!MODES[mode]) throw new Error("Unknown study mode.");
    const current = ensureDay(state, key);
    if (current.tasks.some((task) => task.completed || task.phase !== "ready")) return false;
    state.days[key] = generateDailyPlan(state, key, mode);
    state.profile.defaultMode = mode === "rescue" ? "minimum" : mode;
    return true;
  }

  function currentTask(state, key) {
    return ensureDay(state, key).tasks.find((task) => !task.completed) || null;
  }

  function findTask(state, key, taskId) {
    return ensureDay(state, key).tasks.find((task) => task.id === taskId) || null;
  }

  function startTask(state, key, taskId) {
    const task = findTask(state, key, taskId);
    if (!task || task.completed) return null;
    task.phase = "learning";
    task.startedAt = task.startedAt || new Date().toISOString();
    return task;
  }

  function startQuiz(state, key, taskId) {
    const task = findTask(state, key, taskId);
    if (!task || task.completed) return null;
    task.phase = "quiz";
    return task;
  }

  function intervalForScore(correct, total, futurePasses) {
    const ratio = total ? correct / total : 0;
    if (ratio < 0.4) return 1;
    if (ratio < 0.8) return 3;
    return futurePasses >= 2 ? 14 : 7;
  }

  function recordQuizResult(state, key, taskId, result) {
    const task = findTask(state, key, taskId);
    if (!task || task.completed) return null;
    const total = Math.max(1, Number(result.total || 5));
    const correct = Math.max(0, Math.min(total, Number(result.correct || 0)));
    const score = Math.round((correct / total) * 100);
    const previous = state.progress[task.knowledgeId] || {
      attempts: 0,
      passes: 0,
      bestScore: 0,
      lastScore: 0,
      nextReview: null,
      lastStudied: null
    };
    const passed = score >= 80;
    const passes = previous.passes + (passed ? 1 : 0);
    const interval = intervalForScore(correct, total, passes);
    state.progress[task.knowledgeId] = {
      attempts: previous.attempts + 1,
      passes,
      bestScore: Math.max(previous.bestScore, score),
      lastScore: score,
      nextReview: addDays(key, interval),
      lastStudied: key
    };
    task.completed = true;
    task.phase = "done";
    task.completedAt = new Date().toISOString();
    task.result = {
      correct,
      total,
      score,
      interval,
      source: result.source || (task.hasBuiltInQuiz ? "built-in" : "self-reported"),
      answers: Array.isArray(result.answers) ? [...result.answers] : []
    };
    state.history.push({
      id: makeId("result"),
      date: key,
      knowledgeId: task.knowledgeId,
      subject: task.subject,
      title: task.title,
      kind: task.kind,
      correct,
      total,
      score,
      interval
    });
    return task.result;
  }

  function queueReviewToday(state, key, code) {
    const point = pointByCode(code);
    if (!point) return false;
    const day = ensureDay(state, key);
    if (day.tasks.some((task) => task.knowledgeId === code && !task.completed)) return false;
    const task = taskFromPoint(point, { duration: 15, kind: "review", quizLimit: 5 });
    const activeIndex = day.tasks.findIndex((item) => !item.completed);
    if (activeIndex === -1) day.tasks.push(task);
    else day.tasks.splice(activeIndex, 0, task);
    return true;
  }

  function stats(state, today) {
    const progressValues = Object.values(state.progress);
    const started = progressValues.filter((item) => item.attempts > 0).length;
    const mastered = progressValues.filter((item) => item.passes >= 2 && item.bestScore >= 80).length;
    const sevenDays = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const key = addDays(today, -offset);
      const entries = state.history.filter((entry) => entry.date === key);
      sevenDays.push({
        key,
        completed: entries.length,
        average: entries.length ? Math.round(entries.reduce((sum, item) => sum + item.score, 0) / entries.length) : 0
      });
    }
    const recent = state.history.slice(-20);
    return {
      total: curriculum.length,
      started,
      mastered,
      due: duePoints(state, today).length,
      average: recent.length ? Math.round(recent.reduce((sum, item) => sum + item.score, 0) / recent.length) : 0,
      activeDays: sevenDays.filter((day) => day.completed > 0).length,
      sevenDays
    };
  }

  function modules() {
    const grouped = new Map();
    curriculum.forEach((point) => {
      if (!grouped.has(point.module)) {
        grouped.set(point.module, {
          id: point.module,
          title: point.moduleTitle,
          subject: point.subject,
          points: []
        });
      }
      grouped.get(point.module).points.push(enrichPoint(point));
    });
    return [...grouped.values()];
  }

  return {
    MODES,
    SUBJECT_META,
    CURRICULUM: curriculum.map(enrichPoint),
    QUIZ_BANK,
    addDays,
    createInitialState,
    currentTask,
    dateKey,
    duePoints,
    ensureDay,
    enrichPoint,
    generateDailyPlan,
    intervalForScore,
    migrateStore,
    modules,
    pointByCode,
    questionsFor,
    queueReviewToday,
    recordQuizResult,
    setDayMode,
    startQuiz,
    startTask,
    stats
  };
});
