import LegalDocument, { LegalSection } from "@/components/LegalDocument";

export const metadata = { title: "隐私政策 · AlcheMix Lab" };

export default function PrivacyPage() {
  return <LegalDocument title="隐私政策" updated="2026-08-26">
    <LegalSection title="1. 收集的信息"><p>注册时会处理邮箱、昵称和账号验证状态；使用时可能保存配方、收藏、饮用记录、评分、笔记及必要的产品分析事件。</p></LegalSection>
    <LegalSection title="2. 使用目的"><p>这些信息用于登录验证、跨设备同步、展示个人记录、改善核心流程、保障安全以及处理测试反馈。</p></LegalSection>
    <LegalSection title="3. 服务提供商"><p>网站由 Vercel 托管，账号验证和数据库服务由 Supabase 提供。相关信息可能由这些服务商按其安全与隐私条款处理。</p></LegalSection>
    <LegalSection title="4. 分享与公开"><p>当前版本不会自动公开你的酒记或收藏。若未来上线社区分享，会在发布前明确展示可见范围并再次提供选择。</p></LegalSection>
    <LegalSection title="5. 你的选择"><p>你可以修改昵称、退出登录并请求删除测试账号或相关数据。测试期间如需删除，请联系测试组织者。</p></LegalSection>
    <LegalSection title="6. 数据保护"><p>我们使用登录鉴权、访问控制和传输加密降低风险，但任何网络服务都无法保证绝对安全，请勿填写无关的敏感信息。</p></LegalSection>
  </LegalDocument>;
}
