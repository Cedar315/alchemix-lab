import LegalDocument, { LegalSection } from "@/components/LegalDocument";

export const metadata = { title: "用户协议 · AlcheMix Lab" };

export default function TermsPage() {
  return <LegalDocument title="用户协议" updated="2026-08-26">
    <LegalSection title="1. 测试版服务"><p>AlcheMix Lab 目前处于公开测试阶段，功能、配方和数据结构可能调整。请勿将本服务作为医疗、营养或专业酒类安全建议。</p></LegalSection>
    <LegalSection title="2. 账号使用"><p>请提供你有权使用的邮箱，并妥善保管登录信息。不得利用本服务骚扰他人、批量调用接口或破坏系统。</p></LegalSection>
    <LegalSection title="3. 配方与安全"><p>配方仅供参考。制作前请核对包装标签、酒精度、过敏原、咖啡因及个人健康情况，并遵守所在地关于购买和饮用酒精饮品的法律。</p></LegalSection>
    <LegalSection title="4. 用户内容"><p>你应确保保存的名称、笔记和图片不侵犯他人权利。测试版可能调整或移除不安全、违法或影响服务运行的内容。</p></LegalSection>
    <LegalSection title="5. 服务变更"><p>测试期间可能暂停部分功能、修复数据或调整访问规则。重大条款更新时会更新版本日期，并在需要时重新征得同意。</p></LegalSection>
  </LegalDocument>;
}
