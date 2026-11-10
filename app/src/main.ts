import {
  computed,
  createApp,
  defineComponent,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  type PropType,
} from "vue";

const API_BASE = "http://127.0.0.1:8000";

type Phone = {
  name: string;
  price: string;
  camera: string;
  battery: string;
  downside: string;
  recommended?: boolean;
};

type SourceItem = {
  mark: string;
  markClass: string;
  title: string;
  domain: string;
  date: string;
  excerpt: string;
};

type DailyItem = {
  quote: string;
  author: string;
  type: string;
};

type Step = {
  name: string;
  label: string;
  status: string;
};

type TaskStatus = "idle" | "running" | "done" | "error" | "cancelled";

type TaskState = {
  id: string;
  goal: string;
  status: TaskStatus;
  steps: Step[];
  phones: Phone[];
  sources: SourceItem[];
  conclusion: string;
  error: string;
};

type CollectionItem = {
  id: string;
  title: string;
  domain: string;
  date: string;
  tags: string[];
  summary: string;
  mark: string;
  markClass: string;
};

type StreamEvent = {
  type: string;
  seq?: number;
  [key: string]: any;
};

const defaultPhones: Phone[] = [
  {
    name: "小米 14",
    price: "¥3,999",
    camera: "5000 万像素 · 徕卡主摄",
    battery: "4610mAh / 90W",
    downside: "长焦较短，散热一般",
    recommended: true,
  },
  {
    name: "OPPO Find X7",
    price: "¥4,599",
    camera: "5000 万像素 · 索尼主摄",
    battery: "5000mAh / 100W",
    downside: "算法色彩偏浓",
  },
  {
    name: "vivo X100 Pro",
    price: "¥4,299",
    camera: "5000 万像素 · 蔡司主摄",
    battery: "5000mAh / 120W",
    downside: "系统体验一般",
  },
];

const defaultSources: SourceItem[] = [
  {
    mark: "ZH",
    markClass: "f1",
    title: "小米 14 评测：徕卡三摄的实力担当",
    domain: "中关村在线",
    date: "2024-03-15",
    excerpt:
      "小米 14 搭载骁龙 8 Gen 3 处理器，配备 5000 万像素徕卡主摄，在拍照、性能和续航上都有不错的表现。",
  },
  {
    mark: "IT",
    markClass: "f2",
    title: "OPPO Find X7 体验：影像与性能的平衡之选",
    domain: "IT之家",
    date: "2024-03-10",
    excerpt:
      "Find X7 采用索尼 LYT-800 主摄芯片，支持 100W 超级闪充，续航表现出色，整体体验均衡。",
  },
  {
    mark: "Z",
    markClass: "f3",
    title: "vivo X100 Pro 测评：蔡司影像的专业表现",
    domain: "ZEALER",
    date: "2024-03-08",
    excerpt:
      "X100 Pro 搭载蔡司 T* 镀膜镜头，成像质量优秀，尤其在视频防抖和色彩调校上表现突出。",
  },
];

const defaultConclusion =
  "综合来看，小米 14 在影像表现、系统体验与整体均衡性上最为突出，适合追求全能体验的用户；" +
  "OPPO Find X7 的视频防抖更有优势，vivo X100 Pro 则偏重续航和性能。";

const dailyItems: DailyItem[] = [
  { quote: "山高路远，步履不停。", author: "佚名", type: "景色" },
  { quote: "在每一次选择中，我们都在重塑自己。", author: "佚名", type: "句子" },
  { quote: "读书是在别人思想的帮助下，建立起自己的思想。", author: "鲁迅", type: "书摘" },
  { quote: "慢慢来，比较快。", author: "佚名", type: "句子" },
];

const recentTasks = [
  { title: "帮我选一台 4000–5000 的拍照手机", time: "今天 10:23" },
  { title: "2024 年人工智能行业趋势报告", time: "昨天 15:45" },
  { title: "如何提升英语听力效率", time: "2 天前" },
];

const defaultCollections: CollectionItem[] = [
  {
    id: "c1",
    title: "小米 14 评测：徕卡三摄的实力担当",
    domain: "中关村在线",
    date: "2024-03-15",
    tags: ["数码", "拍照", "对比"],
    summary: "骁龙 8 Gen 3 + 徕卡主摄，性能、续航、影像都在同档位中上游。",
    mark: "ZH",
    markClass: "f1",
  },
  {
    id: "c2",
    title: "OPPO Find X7 体验：影像与性能的平衡之选",
    domain: "IT之家",
    date: "2024-03-10",
    tags: ["数码", "视频", "续航"],
    summary: "LYT-800 主摄 + 100W 闪充，视频防抖和续航是强项。",
    mark: "IT",
    markClass: "f2",
  },
  {
    id: "c3",
    title: "租房避坑指南：签合同前一定要问的 12 件事",
    domain: "知乎",
    date: "2024-02-28",
    tags: ["租房", "合同", "生活"],
    summary: "押金退还、维修责任、提前解约、二房东资质，逐条核对。",
    mark: "知",
    markClass: "f3",
  },
  {
    id: "c4",
    title: "AI Agent 的工具调用：从 Function Calling 到 MCP",
    domain: "少数派",
    date: "2024-03-02",
    tags: ["AI", "Agent", "技术"],
    summary: "工具描述、参数校验、失败回退，决定 Agent 能不能真的把事办完。",
    mark: "少",
    markClass: "f1",
  },
  {
    id: "c5",
    title: "如何用一周时间准备一场技术面试",
    domain: "掘金",
    date: "2024-02-20",
    tags: ["学习", "面试", "计划"],
    summary: "按岗位 JD 拆知识点，先补短板，再做两轮模拟。",
    mark: "掘",
    markClass: "f2",
  },
  {
    id: "c6",
    title: "杭州应届生租房补贴申请流程（2024）",
    domain: "浙江政务服务网",
    date: "2024-01-18",
    tags: ["办事", "补贴", "杭州"],
    summary: "先落户/就业登记，再准备劳动合同和社保记录，线上提交。",
    mark: "浙",
    markClass: "f3",
  },
];

// ----------------------------------------------------------------------
// API：任务创建 + SSE
// ----------------------------------------------------------------------
async function createTask(goal: string): Promise<string> {
  const response = await fetch(`${API_BASE}/api/v1/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ goal }),
  });
  if (!response.ok) throw new Error(`创建任务失败：${response.status}`);
  const payload = await response.json();
  return payload.data.id as string;
}

async function cancelTask(taskId: string): Promise<void> {
  await fetch(`${API_BASE}/api/v1/tasks/${taskId}/cancel`, { method: "POST" });
}

async function streamTask(
  taskId: string,
  handlers: (event: StreamEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const response = await fetch(`${API_BASE}/api/v1/tasks/${taskId}/stream`, { signal });
  if (!response.ok || !response.body) throw new Error(`连接任务失败：${response.status}`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const data = block
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("");
      if (data) {
        try {
          handlers(JSON.parse(data) as StreamEvent);
        } catch {
          // 忽略坏事件，继续读下一条
        }
      }
      boundary = buffer.indexOf("\n\n");
    }
  }
}

function markFor(domain: string, index: number): { mark: string; markClass: string } {
  if (domain.includes("中关村")) return { mark: "ZH", markClass: "f1" };
  if (domain.includes("IT")) return { mark: "IT", markClass: "f2" };
  if (domain.includes("ZEALER")) return { mark: "Z", markClass: "f3" };
  const classes = ["f1", "f2", "f3"];
  return { mark: domain.slice(0, 1).toUpperCase(), markClass: classes[index % 3] };
}

function toSourceItem(raw: Record<string, any>, index: number): SourceItem {
  const domain = String(raw.domain || "来源");
  const mark = markFor(domain, index);
  return {
    mark: mark.mark,
    markClass: mark.markClass,
    title: String(raw.title || "未命名来源"),
    domain,
    date: String(raw.published_at || raw.date || ""),
    excerpt: String(raw.excerpt || ""),
  };
}

// ----------------------------------------------------------------------
// 图标
// ----------------------------------------------------------------------
const Icon = defineComponent({
  name: "AppIcon",
  props: { name: { type: String, required: true } },
  template: `
    <svg v-if="name === 'work'" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="14" height="14" rx="2.5" stroke="currentColor" stroke-width="1.4"/>
      <path d="M3 8h14M8 8v9" stroke="currentColor" stroke-width="1.2" opacity=".7"/>
    </svg>
    <svg v-else-if="name === 'bookmark'" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M5.5 3.8h9v13L10 13.6l-4.5 3.2v-13Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
    </svg>
    <svg v-else-if="name === 'report'" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="4" y="2.8" width="12" height="14.4" rx="1.8" stroke="currentColor" stroke-width="1.4"/>
      <path d="M7 7h6M7 10h6M7 13h3.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
    </svg>
    <svg v-else-if="name === 'settings'" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="2.6" stroke="currentColor" stroke-width="1.4"/>
      <path d="M10 3.2v1.6M10 15.2v1.6M3.2 10h1.6M15.2 10h1.6M5.2 5.2l1.1 1.1M13.7 13.7l1.1 1.1M14.8 5.2l-1.1 1.1M6.3 13.7l-1.1 1.1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
    </svg>
    <svg v-else-if="name === 'send'" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="m3.4 9.4 12.8-5.1-4.1 12.4-2.3-5-6.4-2.3Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
    </svg>
    <svg v-else-if="name === 'refresh'" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M15.5 8.2A6 6 0 1 0 16 12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
      <path d="M15.6 4.2v4h-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <svg v-else-if="name === 'arrow'" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 10h11M11 6l4 4-4 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <svg v-else-if="name === 'search'" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="8.8" cy="8.8" r="5.2" stroke="currentColor" stroke-width="1.4"/>
      <path d="m13 13 3.4 3.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
    </svg>
    <svg v-else-if="name === 'plus'" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
    </svg>
    <svg v-else-if="name === 'trash'" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4.5 6h11M8 3.8h4M6 6l.7 10.2h6.6L14 6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <svg v-else-if="name === 'download'" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 3.5v8M7 8.8l3 3 3-3M4.5 15.5h11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <svg v-else-if="name === 'print'" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M6 7V3.8h8V7M6 13.5H4.5V8.2h11v5.3H14" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
      <rect x="6" y="11" width="8" height="5.2" rx="1" stroke="currentColor" stroke-width="1.3"/>
    </svg>
    <svg v-else-if="name === 'key'" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="7" cy="12.7" r="3.2" stroke="currentColor" stroke-width="1.4"/>
      <path d="m9.3 10.4 5.2-5.2M12.8 6.9l1.5 1.5M14.3 5.4l1.5 1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
    </svg>
    <svg v-else-if="name === 'database'" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <ellipse cx="10" cy="5" rx="5.8" ry="2.4" stroke="currentColor" stroke-width="1.3"/>
      <path d="M4.2 5v10c0 1.3 2.6 2.4 5.8 2.4s5.8-1.1 5.8-2.4V5M4.2 10c0 1.3 2.6 2.4 5.8 2.4s5.8-1.1 5.8-2.4" stroke="currentColor" stroke-width="1.3"/>
    </svg>
    <svg v-else-if="name === 'info'" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="6.8" stroke="currentColor" stroke-width="1.3"/>
      <path d="M10 9v4M10 6.8v.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
    <svg v-else-if="name === 'check'" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="m4.5 10.5 3.3 3.3 7.7-7.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <svg v-else viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="6.5" stroke="currentColor" stroke-width="1.3"/>
    </svg>
  `,
});

// ----------------------------------------------------------------------
// 侧栏
// ----------------------------------------------------------------------
const SideBar = defineComponent({
  name: "SideBar",
  components: { Icon },
  props: { route: { type: String, required: true } },
  setup() {
    return { recentTasks };
  },
  template: `
    <aside class="sidebar">
      <div class="brand">
        <div class="seal">拾</div>
        <div class="brand-text"><strong>拾页</strong><span>SHIYE</span></div>
      </div>
      <nav class="nav">
        <a href="#workspace" :class="{ active: route === 'workspace' }"><Icon name="work" />工作台</a>
        <a href="#library" :class="{ active: route === 'library' }"><Icon name="bookmark" />收藏</a>
        <a href="#weekly" :class="{ active: route === 'weekly' }"><Icon name="report" />周报</a>
        <a href="#settings" :class="{ active: route === 'settings' }"><Icon name="settings" />设置</a>
      </nav>
      <div class="side-section">
        <p class="side-label">最近任务</p>
        <div v-for="item in recentTasks" :key="item.title" class="recent">
          <p class="recent-title">{{ item.title }}</p>
          <p class="recent-meta">{{ item.time }}</p>
        </div>
      </div>
      <div class="side-bottom">
        <div class="mini-card"><div class="mini-art"></div><p>每日灵感</p></div>
        <div class="version">V1.0 · 本地演示</div>
      </div>
    </aside>
  `,
});

// ----------------------------------------------------------------------
// 工作台
// ----------------------------------------------------------------------
const TaskHeader = defineComponent({
  name: "TaskHeader",
  props: {
    task: { type: Object as PropType<TaskState>, required: true },
  },
  emits: ["refresh", "cancel"],
  computed: {
    statusText(): string {
      const status = (this.task as TaskState).status;
      return {
        idle: "待开始",
        running: "正在分析…",
        done: "已完成",
        error: "出错了",
        cancelled: "已停止",
      }[status] as string;
    },
    pageCount(): number {
      const task = this.task as TaskState;
      if (task.status === "done") return 5;
      if (task.status === "running") return Math.max(1, task.sources.length + 1);
      return 0;
    },
    sourceCount(): number {
      return (this.task as TaskState).sources.length;
    },
  },
  template: `
    <header class="task-head">
      <div>
        <p class="eyebrow">工作台 / 任务</p>
        <h1>{{ task.goal }}</h1>
        <p class="task-meta">
          <span class="status-dot" :class="{ busy: task.status === 'running', error: task.status === 'error' }"></span>
          {{ sourceCount }} 个来源 · {{ pageCount }} 个页面 · {{ statusText }}
          <span class="sep">·</span>
          今天 10:23
        </p>
      </div>
      <button v-if="task.status === 'running'" class="ghost-btn stop" @click="$emit('cancel')">停止</button>
      <button v-else class="ghost-btn" :disabled="task.status === 'running'" @click="$emit('refresh')">重新整理</button>
    </header>
  `,
});

const TaskProgress = defineComponent({
  name: "TaskProgress",
  props: {
    steps: { type: Array as PropType<Step[]>, required: true },
  },
  computed: {
    label(): string {
      const steps = this.steps as Step[];
      if (!steps.length) return "正在拆解目标…";
      return steps[steps.length - 1].label;
    },
    percent(): number {
      const steps = this.steps as Step[];
      return Math.min(92, 12 + steps.length * 14);
    },
  },
  template: `
    <div class="task-progress">
      <div class="task-progress__bar"><span :style="{ width: percent + '%' }"></span></div>
      <span class="task-progress__label">{{ label }}</span>
    </div>
  `,
});

const FollowUp = defineComponent({
  name: "FollowUp",
  components: { Icon },
  emits: ["send"],
  setup(_, { emit }) {
    const text = ref("");
    const send = () => {
      const value = text.value.trim();
      if (!value) return;
      emit("send", value);
      text.value = "";
    };
    return { text, send };
  },
  template: `
    <div class="follow-up">
      <span class="follow-icon">↳</span>
      <input v-model="text" placeholder="继续追问，或补充条件…" @keyup.enter="send" />
      <button class="send" aria-label="发送" @click="send"><Icon name="send" /></button>
    </div>
  `,
});

const CompareCard = defineComponent({
  name: "CompareCard",
  components: { Icon },
  props: {
    task: { type: Object as PropType<TaskState>, required: true },
    collected: { type: Boolean, default: false },
  },
  emits: ["collect", "weekly"],
  computed: {
    showSkeleton(): boolean {
      const task = this.task as TaskState;
      return task.status === "running" && !task.phones.length;
    },
  },
  template: `
    <section class="paper compare-card">
      <div v-if="showSkeleton" class="skeleton-block">
        <div class="skeleton-line w70"></div>
        <div class="skeleton-line w90"></div>
        <div class="skeleton-line w50"></div>
      </div>
      <template v-else>
        <table class="compare">
          <thead>
            <tr><th>机型</th><th>价格</th><th>主摄</th><th>续航</th><th>主要差评</th></tr>
          </thead>
          <tbody>
            <tr v-for="phone in task.phones" :key="phone.name" :class="{ best: phone.recommended }">
              <td><span v-if="phone.recommended" class="pick">推荐</span>{{ phone.name }}</td>
              <td>{{ phone.price }}</td>
              <td>{{ phone.camera }}</td>
              <td>{{ phone.battery }}</td>
              <td>{{ phone.downside }}</td>
            </tr>
          </tbody>
        </table>

        <div class="conclusion">
          <p class="conclusion-label">结论</p>
          <p>
            {{ task.conclusion || "正在整理结论…" }}
            <span class="cite">[1]</span><span class="cite">[2]</span><span class="cite">[3]</span>
          </p>
        </div>

        <div class="card-actions">
          <button class="primary" :disabled="collected" @click="$emit('collect')">
            {{ collected ? "已收藏" : "加入收藏" }}
          </button>
          <button class="line" @click="$emit('weekly')">生成本周周报</button>
        </div>

        <p v-if="task.status === 'error'" class="inline-error">任务失败：{{ task.error || "请稍后重试" }}</p>
      </template>
    </section>
  `,
});

const DailyCard = defineComponent({
  name: "DailyCard",
  components: { Icon },
  props: { item: { type: Object as PropType<DailyItem>, required: true } },
  emits: ["next"],
  template: `
    <section class="paper daily">
      <div class="daily-art">
        <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <defs>
            <linearGradient id="dailySky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#d8d3c1"/><stop offset="0.55" stop-color="#eee6d2"/><stop offset="1" stop-color="#cfc8b4"/>
            </linearGradient>
            <linearGradient id="dailyWater" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#8d9a8a"/><stop offset="1" stop-color="#5f7064"/>
            </linearGradient>
          </defs>
          <rect width="320" height="180" fill="url(#dailySky)"/>
          <path d="M0 112 L54 56 L92 94 L128 44 L186 108 L222 70 L272 116 L320 84 L320 180 L0 180 Z" fill="#6f7566"/>
          <path d="M0 126 L64 92 L104 120 L150 84 L210 128 L254 102 L320 132 L320 180 L0 180 Z" fill="#59645a"/>
          <rect y="132" width="320" height="48" fill="url(#dailyWater)"/>
          <path d="M0 140 L40 130 L80 142 L120 132 L160 144 L210 133 L260 145 L320 135" stroke="#c9d0c0" stroke-width="1" fill="none" opacity=".45"/>
          <path d="M0 152 L50 146 L100 154 L150 147 L210 156 L270 146 L320 153" stroke="#dfe3d4" stroke-width="1" fill="none" opacity=".3"/>
        </svg>
        <span class="daily-tag">每日灵感 · {{ item.type }}</span>
      </div>
      <div class="daily-body">
        <p class="quote">「{{ item.quote }}」</p>
        <p class="quote-author">— {{ item.author }}</p>
        <div class="daily-foot">
          <span>今天 · {{ item.type }}</span>
          <button class="text-btn" @click="$emit('next')">换一个 <Icon name="refresh" /></button>
        </div>
      </div>
    </section>
  `,
});

const SourceList = defineComponent({
  name: "SourceList",
  components: { Icon },
  props: {
    items: { type: Array as PropType<SourceItem[]>, required: true },
    running: { type: Boolean, default: false },
  },
  computed: {
    isEmpty(): boolean {
      return !(this.items as SourceItem[]).length;
    },
    showLoading(): boolean {
      return this.isEmpty && this.running;
    },
  },
  template: `
    <section class="sources">
      <div class="sources-head">
        <h2>来源</h2>
        <span class="count">{{ items.length }}</span>
        <span class="sources-spacer"></span>
        <button class="text-btn">换一批 <Icon name="refresh" /></button>
      </div>
      <article v-for="item in items" :key="item.title" class="source paper">
        <div class="source-top">
          <span class="favicon" :class="item.markClass">{{ item.mark }}</span>
          <div><h3>{{ item.title }}</h3><p class="source-meta">{{ item.domain }} · {{ item.date }}</p></div>
        </div>
        <p class="excerpt">{{ item.excerpt }}</p>
        <button class="text-btn source-link">打开原文 <Icon name="arrow" /></button>
      </article>
      <div v-if="showLoading" class="source paper source-loading">正在读取来源…</div>
      <div v-else-if="isEmpty" class="source paper source-loading">还没有来源，先提一个目标。</div>
    </section>
  `,
});

const WorkspaceView = defineComponent({
  name: "WorkspaceView",
  components: { TaskHeader, TaskProgress, FollowUp, CompareCard, DailyCard, SourceList },
  props: {
    task: { type: Object as PropType<TaskState>, required: true },
    daily: { type: Object as PropType<DailyItem>, required: true },
    collected: { type: Boolean, default: false },
  },
  emits: ["refresh", "cancel", "send", "next-daily", "collect", "weekly"],
  template: `
    <div class="workspace">
      <div class="content">
        <TaskHeader :task="task" @refresh="$emit('refresh')" @cancel="$emit('cancel')" />
        <FollowUp @send="$emit('send', $event)" />
        <TaskProgress v-if="task.status === 'running'" :steps="task.steps" />
        <CompareCard :task="task" :collected="collected" @collect="$emit('collect')" @weekly="$emit('weekly')" />
      </div>
      <aside class="rail">
        <DailyCard :item="daily" @next="$emit('next-daily')" />
        <SourceList :items="task.sources" :running="task.status === 'running'" />
      </aside>
    </div>
  `,
});

// ----------------------------------------------------------------------
// 收藏
// ----------------------------------------------------------------------
const LibraryView = defineComponent({
  name: "LibraryView",
  components: { Icon },
  props: {
    items: { type: Array as PropType<CollectionItem[]>, required: true },
  },
  emits: ["delete", "open"],
  setup(props) {
    const query = ref("");
    const filtered = computed(() => {
      const value = query.value.trim().toLowerCase();
      if (!value) return (props.items as CollectionItem[]);
      return (props.items as CollectionItem[]).filter((item) => {
        const text = `${item.title} ${item.summary} ${item.tags.join(" ")} ${item.domain}`.toLowerCase();
        return text.includes(value);
      });
    });
    return { query, filtered };
  },
  template: `
    <div class="page">
      <header class="page-head">
        <div>
          <p class="eyebrow">拾页 / 收藏</p>
          <h1>收藏</h1>
          <p class="page-sub">存下来的网页，按意思找回来。共 {{ items.length }} 条。</p>
        </div>
        <button class="line-btn"><Icon name="plus" />粘贴链接</button>
      </header>

      <div class="search-bar">
        <Icon name="search" />
        <input v-model="query" placeholder="用自然语言找：上次那篇讲租房避坑的文章…" />
        <span class="search-mode">语义搜索</span>
      </div>

      <div v-if="filtered.length" class="collection-grid">
        <article v-for="item in filtered" :key="item.id" class="paper collection-card">
          <div class="collection-top">
            <span class="favicon" :class="item.markClass">{{ item.mark }}</span>
            <div class="collection-head">
              <h3>{{ item.title }}</h3>
              <p>{{ item.domain }} · {{ item.date }}</p>
            </div>
            <button class="icon-btn" title="删除" @click="$emit('delete', item.id)"><Icon name="trash" /></button>
          </div>
          <p class="collection-summary">{{ item.summary }}</p>
          <div class="collection-foot">
            <span v-for="tag in item.tags" :key="tag" class="tag">{{ tag }}</span>
            <button class="text-btn" @click="$emit('open', item)">打开原文 <Icon name="arrow" /></button>
          </div>
        </article>
      </div>
      <div v-else class="empty-state paper">
        <p class="empty-title">没有找到匹配的收藏</p>
        <p>换个说法，或去工作台把一次分析加入收藏。</p>
      </div>
    </div>
  `,
});

// ----------------------------------------------------------------------
// 周报
// ----------------------------------------------------------------------
const WeeklyView = defineComponent({
  name: "WeeklyView",
  components: { Icon },
  props: {
    report: { type: Object as PropType<any>, required: true },
  },
  emits: ["export", "print", "regenerate"],
  template: `
    <div class="page weekly-page">
      <header class="page-head">
        <div>
          <p class="eyebrow">拾页 / 周报</p>
          <h1>个人周报</h1>
          <p class="page-sub">{{ report.range }} · 给自己看的一周复盘</p>
        </div>
        <div class="head-actions">
          <button class="line-btn" @click="$emit('regenerate')"><Icon name="refresh" />重新生成</button>
          <button class="line-btn" @click="$emit('export')"><Icon name="download" />导出 MD</button>
          <button class="primary-btn" @click="$emit('print')"><Icon name="print" />打印 / PDF</button>
        </div>
      </header>

      <section class="paper weekly-card">
        <div class="weekly-section">
          <p class="weekly-label">01 · 本周关注</p>
          <div class="focus-list">
            <span v-for="item in report.focus" :key="item" class="focus-chip">{{ item }}</span>
          </div>
        </div>

        <div class="weekly-section">
          <p class="weekly-label">02 · 三条收获</p>
          <ol class="gain-list">
            <li v-for="item in report.gains" :key="item">{{ item }}</li>
          </ol>
        </div>

        <div class="weekly-section">
          <p class="weekly-label">03 · 收藏精选</p>
          <div class="weekly-picks">
            <article v-for="item in report.picks" :key="item.id" class="weekly-pick">
              <h3>{{ item.title }}</h3>
              <p>{{ item.summary }}</p>
              <span>{{ item.domain }}</span>
            </article>
          </div>
        </div>

        <div class="weekly-columns">
          <div class="weekly-section">
            <p class="weekly-label">04 · 没做完的</p>
            <ul class="plain-list">
              <li v-for="item in report.undone" :key="item">{{ item }}</li>
            </ul>
          </div>
          <div class="weekly-section">
            <p class="weekly-label">05 · 下周建议</p>
            <ul class="plain-list">
              <li v-for="item in report.next" :key="item">{{ item }}</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  `,
});

// ----------------------------------------------------------------------
// 设置
// ----------------------------------------------------------------------
const SettingsView = defineComponent({
  name: "SettingsView",
  components: { Icon },
  emits: ["save"],
  setup() {
    const saved = {
      baseUrl: localStorage.getItem("shiye.baseUrl") || "https://api.deepseek.com/v1",
      model: localStorage.getItem("shiye.model") || "deepseek-chat",
      apiKey: "",
      search: localStorage.getItem("shiye.search") || "mock",
    };
    const form = reactive(saved);
    return { form };
  },
  template: `
    <div class="page settings-page">
      <header class="page-head">
        <div>
          <p class="eyebrow">拾页 / 设置</p>
          <h1>设置</h1>
          <p class="page-sub">模型、搜索源和数据都在这里。Key 只放服务端，不进前端。</p>
        </div>
        <button class="primary-btn" @click="$emit('save', form)"><Icon name="check" />保存草稿</button>
      </header>

      <section class="paper settings-card">
        <div class="settings-head"><span class="settings-icon"><Icon name="key" /></span><div><h2>大模型</h2><p>OpenAI 兼容接口，优先 DeepSeek</p></div></div>
        <div class="form-grid">
          <label><span>Base URL</span><input v-model="form.baseUrl" /></label>
          <label><span>模型</span><input v-model="form.model" /></label>
          <label class="wide"><span>API Key（仅演示，不保存明文）</span><input v-model="form.apiKey" type="password" placeholder="sk-... 由服务端 .env 读取" /></label>
        </div>
        <p class="form-note">真实 Key 请在服务端 env 配置；这里只保存非敏感草稿。</p>
      </section>

      <section class="paper settings-card">
        <div class="settings-head"><span class="settings-icon"><Icon name="search" /></span><div><h2>搜索源</h2><p>先用 mock，接入后换真实搜索 API</p></div></div>
        <div class="segmented">
          <button :class="{ active: form.search === 'mock' }" @click="form.search = 'mock'">Mock 演示</button>
          <button :class="{ active: form.search === 'bocha' }" @click="form.search = 'bocha'">博查</button>
          <button :class="{ active: form.search === 'tavily' }" @click="form.search = 'tavily'">Tavily</button>
        </div>
      </section>

      <section class="paper settings-card">
        <div class="settings-head"><span class="settings-icon"><Icon name="database" /></span><div><h2>数据</h2><p>当前收藏和任务都在本地 SQLite / localStorage</p></div></div>
        <div class="settings-row"><span>收藏 {{ 6 }} 条 · 任务 {{ 3 }} 条</span><button class="line-btn danger">清空演示数据</button></div>
      </section>

      <section class="paper settings-card about">
        <div class="settings-head"><span class="settings-icon"><Icon name="info" /></span><div><h2>关于拾页</h2><p>V1.0 · 前端演示版</p></div></div>
        <p>搜得清楚，存得下来，找得回去。当前工作台已接 mock 任务 API，收藏/周报/设置为前端演示数据。</p>
      </section>
    </div>
  `,
});

// ----------------------------------------------------------------------
// App
// ----------------------------------------------------------------------
const App = defineComponent({
  name: "App",
  components: { SideBar, WorkspaceView, LibraryView, WeeklyView, SettingsView },
  setup() {
    const route = ref("workspace");
    const sync = () => {
      const hash = window.location.hash.replace("#", "");
      route.value = ["workspace", "library", "weekly", "settings"].includes(hash)
        ? hash
        : "workspace";
    };
    onMounted(() => {
      sync();
      window.addEventListener("hashchange", sync);
    });
    onUnmounted(() => window.removeEventListener("hashchange", sync));

    const dailyIndex = ref(0);
    const daily = computed(() => dailyItems[dailyIndex.value]);
    const nextDaily = () => {
      dailyIndex.value = (dailyIndex.value + 1) % dailyItems.length;
    };

    const collections = ref<CollectionItem[]>([...defaultCollections]);
    const collected = ref(false);
    const toast = ref("");
    let toastTimer: number | undefined;
    const showToast = (message: string) => {
      toast.value = message;
      window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => (toast.value = ""), 2600);
    };

    const task = reactive<TaskState>({
      id: "",
      goal: "帮我选一台 4000–5000 的拍照手机",
      status: "done",
      steps: [],
      phones: [...defaultPhones],
      sources: [...defaultSources],
      conclusion: defaultConclusion,
      error: "",
    });

    let controller: AbortController | null = null;

    const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

    const applyEvent = (event: StreamEvent) => {
      if (event.type === "step") {
        const step: Step = {
          name: String(event.name || ""),
          label: String(event.label || ""),
          status: String(event.status || "done"),
        };
        const existing = task.steps.findIndex((item) => item.name === step.name);
        if (existing >= 0) task.steps[existing] = step;
        else task.steps.push(step);
      } else if (event.type === "sources") {
        task.sources = (event.items as Record<string, any>[]).map(toSourceItem);
      } else if (event.type === "delta") {
        task.conclusion += String(event.text || "");
      } else if (event.type === "done") {
        const result = event.result || {};
        task.status = "done";
        task.conclusion = String(result.summary || task.conclusion || defaultConclusion);
        if (Array.isArray(result.phones) && result.phones.length) {
          task.phones = result.phones as Phone[];
        }
        showToast("任务完成，结论已更新");
      } else if (event.type === "error") {
        task.status = "error";
        task.error = String(event.message || "任务失败");
      }
    };

    const runMock = async (goal: string) => {
      task.steps = [];
      task.sources = [];
      task.phones = [];
      task.conclusion = "";
      const steps: Step[] = [
        { name: "plan", label: "拆解目标：拍照、预算、续航、差评", status: "done" },
        { name: "search", label: "搜索 3 个来源", status: "done" },
        { name: "read", label: "读 3 个页面", status: "done" },
        { name: "compare", label: "对齐价格、主摄、续航与差评", status: "done" },
        { name: "done", label: "生成结论", status: "done" },
      ];
      for (const step of steps) {
        if (task.status !== "running") return;
        task.steps.push(step);
        await wait(360);
      }
      if (task.status !== "running") return;
      task.sources = [...defaultSources];
      task.phones = [...defaultPhones];
      for (const chunk of defaultConclusion.match(/.{1,18}/g) || []) {
        if (task.status !== "running") return;
        task.conclusion += chunk;
        await wait(55);
      }
      task.status = "done";
      task.goal = goal;
      showToast("后端未连接，已用本地演示数据完成");
    };

    const startTask = async (goal: string) => {
      if (task.status === "running") return;
      task.goal = goal;
      task.status = "running";
      task.steps = [];
      task.sources = [];
      task.phones = [];
      task.conclusion = "";
      task.error = "";
      collected.value = false;
      controller = new AbortController();
      try {
        const taskId = await createTask(goal);
        task.id = taskId;
        await streamTask(taskId, applyEvent, controller.signal);
        if (task.status === "running") task.status = "done";
      } catch (error: any) {
        if (error?.name === "AbortError") {
          task.status = "cancelled";
          return;
        }
        await runMock(goal);
      }
    };

    const stopTask = async () => {
      if (controller) controller.abort();
      if (task.id) {
        try {
          await cancelTask(task.id);
        } catch {
          // 后端不在线时忽略
        }
      }
      task.status = "cancelled";
      showToast("已停止这次任务");
    };

    const addCollection = () => {
      if (!task.phones.length) return;
      const exists = collections.value.some((item) => item.title === task.goal);
      if (exists) {
        showToast("这条已经收藏过了");
        return;
      }
      collections.value.unshift({
        id: `c_${Date.now()}`,
        title: task.goal,
        domain: "拾页整理",
        date: "今天",
        tags: ["对比", "决策"],
        summary: task.conclusion.slice(0, 60) + (task.conclusion.length > 60 ? "…" : ""),
        mark: "拾",
        markClass: "f1",
      });
      collected.value = true;
      showToast("已加入收藏，可以去收藏页查看");
    };

    const deleteCollection = (id: string) => {
      collections.value = collections.value.filter((item) => item.id !== id);
      showToast("已删除");
    };

    const openCollection = (item: CollectionItem) => {
      showToast(`演示：会打开 ${item.domain} 的原文`);
    };

    const weekly = computed(() => {
      const picks = collections.value.slice(0, 3);
      return {
        range: "11.04 – 11.10",
        focus: ["拍照手机怎么选", "AI Agent 的工具调用", "租房合同避坑"],
        gains: [
          "同价位手机不能只看主摄参数，散热和长焦决定了日常体验。",
          "Agent 能不能把事办完，取决于工具描述、参数校验和失败回退。",
          "租房合同里，押金退还和维修责任比租金更值得逐条确认。",
        ],
        picks,
        undone: ["预约牙医", "整理报销单", "把收藏里的评测做成对比表"],
        next: ["把「拍照手机」的结果整理成一页决策卡", "给下周的课程汇报留两个完整下午", "补一次 5 公里慢跑"],
      };
    });

    const exportWeekly = () => {      const report = weekly.value;
      const lines = [
        `# 拾页 · 个人周报（${report.range}）`,
        "",
        "## 本周关注",
        ...report.focus.map((item) => `- ${item}`),
        "",
        "## 三条收获",
        ...report.gains.map((item, index) => `${index + 1}. ${item}`),
        "",
        "## 收藏精选",
        ...report.picks.map((item) => `- [${item.title}](${item.domain})：${item.summary}`),
        "",
        "## 没做完的",
        ...report.undone.map((item) => `- ${item}`),
        "",
        "## 下周建议",
        ...report.next.map((item) => `- ${item}`),
        "",
        "> 由拾页生成，内容来自本周收藏与任务。",
      ];
      const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "拾页-个人周报.md";
      link.click();
      URL.revokeObjectURL(url);
      showToast("周报已导出 Markdown");
    };

    const saveSettings = (form: { baseUrl: string; model: string; apiKey: string; search: string }) => {
      localStorage.setItem("shiye.baseUrl", form.baseUrl);
      localStorage.setItem("shiye.model", form.model);
      localStorage.setItem("shiye.search", form.search);
      showToast("设置草稿已保存；Key 不写入前端");
    };

    const goWeekly = () => {
      route.value = "weekly";
    };

    const printWeekly = () => {
      window.print();
    };

    return {
      route,
      daily,
      nextDaily,
      task,
      collections,
      collected,
      toast,
      weekly,
      startTask,
      stopTask,
      addCollection,
      deleteCollection,
      openCollection,
      exportWeekly,
      saveSettings,
      goWeekly,
      printWeekly,
      showToast,
    };
  },
  template: `
    <div class="app">
      <SideBar :route="route" />
      <main class="main" :class="{ single: route !== 'workspace' }">
        <WorkspaceView
          v-if="route === 'workspace'"
          :task="task"
          :daily="daily"
          :collected="collected"
          @refresh="startTask(task.goal)"
          @cancel="stopTask"
          @send="startTask"
          @next-daily="nextDaily"
          @collect="addCollection"
          @weekly="goWeekly"
        />
        <LibraryView
          v-else-if="route === 'library'"
          :items="collections"
          @delete="deleteCollection"
          @open="openCollection"
        />
        <WeeklyView
          v-else-if="route === 'weekly'"
          :report="weekly"
          @export="exportWeekly"
          @print="printWeekly"
          @regenerate="showToast('周报已重新生成（演示）')"
        />
        <SettingsView v-else @save="saveSettings" />
      </main>
      <div v-if="toast" class="toast">{{ toast }}</div>
    </div>
  `,
});

createApp(App).mount("#app");
