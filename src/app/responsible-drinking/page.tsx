import LegalDocument, { LegalSection } from "@/components/LegalDocument";

export const metadata = { title: "饮酒安全提示 · AlcheMix Lab" };

export default function ResponsibleDrinkingPage() {
  return <LegalDocument title="饮酒安全提示" updated="2026-08-26">
    <LegalSection title="仅限达到法定饮酒年龄的用户"><p>只有达到所在地法定饮酒年龄的人才应制作或饮用含酒精配方。未达到年龄请使用无酒精版本。</p></LegalSection>
    <LegalSection title="饮酒不驾车"><p>饮酒后不要驾驶、骑行、游泳、操作机械或从事需要清醒判断的活动，并提前安排安全交通方式。</p></LegalSection>
    <LegalSection title="了解真实酒精量"><p>口感柔和、甜味或大量冰块不会消除酒精。请核对基酒酒精度与实际用量，控制饮用速度并补充水分。</p></LegalSection>
    <LegalSection title="特殊情况"><p>孕期、服药期间、存在肝脏或其他健康问题、对配料过敏或不确定是否适合饮酒时，请避免饮酒并咨询专业人士。</p></LegalSection>
    <LegalSection title="紧急情况"><p>若出现意识不清、呼吸异常、持续呕吐或无法唤醒等情况，请立即联系当地紧急服务，不要让当事人独处。</p></LegalSection>
  </LegalDocument>;
}
