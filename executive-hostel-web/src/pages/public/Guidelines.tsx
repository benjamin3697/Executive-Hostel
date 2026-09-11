import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronDown,
  Clock3,
  CreditCard,
  KeyRound,
  Search,
  Printer,
  Trash2,
  Users,
  Utensils,
  Zap,
} from "lucide-react";
import { api, GuidelineRow } from "../../lib/api";

type Rule = { number: number; text: string; summary: string; tag?: string; tagTone?: "critical" | "time" | "notice" };
type Category = {
  id: string;
  title: string;
  description: string;
  icon: typeof AlertTriangle;
  numbers: number[];
};

const CATEGORIES: Category[] = [
  { id: "payments", title: "Payments & Admission", description: "Fees, admission decisions, and keeping your accommodation in good standing.", icon: CreditCard, numbers: [1, 2, 3, 4, 5] },
  { id: "security", title: "Security, Keys & Access", description: "Protect your belongings, use access devices responsibly, and report problems quickly.", icon: KeyRound, numbers: [21, 22, 23, 24, 35, 36, 37, 38, 39] },
  { id: "quiet", title: "Quiet Hours & Behaviour", description: "Respectful conduct and a calm environment for everyone to study and rest.", icon: Clock3, numbers: [6, 7, 8, 9, 32, 33, 34] },
  { id: "visitors", title: "Visitors Policy", description: "Visiting hours, registration, room access, and resident responsibility for guests.", icon: Users, numbers: [25, 26, 27, 28, 29, 30, 31] },
  { id: "safety", title: "Electrical & Fire Safety", description: "Simple habits that reduce electrical, fire, and emergency risks.", icon: Zap, numbers: [16, 17, 18, 19, 20] },
  { id: "cooking", title: "Cooking & Shared Amenities", description: "Use shared facilities safely, hygienically, and only where permitted.", icon: Utensils, numbers: [40, 41, 42] },
  { id: "hygiene", title: "Hygiene & Property Care", description: "Keep rooms and shared areas clean and take care of hostel property.", icon: Trash2, numbers: [12, 13, 14, 15, 43, 44, 45] },
  { id: "discipline", title: "Discipline & Regulations", description: "Prohibited substances, management authority, complaints, and enforcement.", icon: AlertTriangle, numbers: [10, 11, 46, 47, 48, 49, 50, 51, 52] },
];

const SUMMARIES: Record<number, Omit<Rule, "number" | "text">> = {
  1: { summary: "Admission is approved at Management's discretion." },
  2: { summary: "Pay at least 50% of the applicable hostel fees before admission.", tag: "50% deposit required", tagTone: "critical" },
  3: { summary: "Clear all outstanding fees within two months of admission. Government-sponsored students may request an approved reconsideration." },
  4: { summary: "Unpaid fees may lead to restricted, suspended, or terminated accommodation." },
  5: { summary: "When accommodation is restricted for unpaid fees, personal property may not be removed except through approved hostel procedures." },
  6: { summary: "Treat residents, staff, and visitors with courtesy and do not threaten, harass, or unreasonably disturb anyone." },
  7: { summary: "Fighting, threats, bullying, harassment, vandalism, disorderly conduct, and abusive behaviour are prohibited.", tag: "Strict", tagTone: "critical" },
  8: { summary: "Dress and behave in a decent and appropriate manner." },
  9: { summary: "Follow lawful Management and staff instructions about safety, security, cleanliness, and administration." },
  10: { summary: "Smoking, alcohol, narcotic drugs, and other prohibited substances are not allowed in or around the hostel.", tag: "Strict", tagTone: "critical" },
  11: { summary: "Substance-related conduct that threatens safety or wellbeing may lead to discipline and referral to authorities.", tag: "Strict", tagTone: "critical" },
  12: { summary: "Keep your room, shared facilities, and compound clean and orderly." },
  13: { summary: "Do not deface, damage, remove, or misuse hostel property, furniture, fixtures, or equipment.", tag: "Property care", tagTone: "notice" },
  14: { summary: "Anyone responsible for damage may be required to pay the reasonable repair or replacement cost." },
  15: { summary: "Dispose of waste properly and follow Management's hygiene requirements." },
  16: { summary: "Switch off lights and electrical equipment before leaving your room." },
  17: { summary: "Use electric stoves, heaters, and other high-power appliances only in areas designated by Management.", tag: "Safety", tagTone: "critical" },
  18: { summary: "Never tamper with wiring, sockets, electrical installations, fire equipment, or safety installations.", tag: "Safety", tagTone: "critical" },
  19: { summary: "Open flames and candles are prohibited unless Management expressly authorises them.", tag: "Fire safety", tagTone: "critical" },
  20: { summary: "Know the emergency exits and report fires, electrical faults, gas leaks, and other emergencies immediately." },
  21: { summary: "Management is generally not responsible for loss, theft, or damage to personal belongings except where the law requires otherwise." },
  22: { summary: "Secure your property and avoid keeping large amounts of cash or valuables in your room." },
  23: { summary: "Report loss, theft, damage, or suspicious activity to Management promptly.", tag: "Report promptly", tagTone: "notice" },
  24: { summary: "Do not take, use, or keep another resident's property without permission." },
  25: { summary: "Visitors are allowed only during visiting hours and must leave the hostel and rooms by 9:00 p.m.", tag: "Visitors out by 9 PM", tagTone: "time" },
  26: { summary: "Overnight visitors are prohibited unless Management gives written approval.", tag: "No overnight visitors", tagTone: "critical" },
  27: { summary: "Visitors must follow hostel security and registration procedures." },
  28: { summary: "A visitor may stay only in the inviting resident's room or designated area and may not enter other rooms without permission." },
  29: { summary: "The resident who invites a visitor is responsible for that visitor's conduct and compliance." },
  30: { summary: "Do not enter another resident's room without permission, except for authorised access or an emergency." },
  31: { summary: "Authorised staff may access rooms for maintenance, inspection, safety, emergencies, or other legitimate purposes, with reasonable notice where practical." },
  32: { summary: "Observe strict silence from 11:00 p.m. to 5:30 a.m.", tag: "Quiet hours: 11 PM – 5:30 AM", tagTone: "time" },
  33: { summary: "Keep music, television, conversations, and other noise from being unreasonably audible outside your room." },
  34: { summary: "Parties or activities likely to disturb residents are prohibited unless Management authorises them." },
  35: { summary: "Report electrical, plumbing, furniture, sanitation, security, and facility problems through the Complaints Book or designated reporting process." },
  36: { summary: "Do not attempt unauthorised repairs or alterations to electrical, plumbing, or other hostel installations." },
  37: { summary: "Safeguard all hostel keys, access cards, and security devices issued to you." },
  38: { summary: "Report lost keys or access devices immediately. Management will communicate any replacement cost." },
  39: { summary: "Do not duplicate, lend, transfer, or misuse hostel keys or access devices without authorisation." },
  40: { summary: "Cook only in areas designated by Management." },
  41: { summary: "Clean cooking and shared facilities after use, and never leave cooking appliances unattended." },
  42: { summary: "Store and dispose of food hygienically to prevent pests." },
  43: { summary: "Park vehicles only in designated areas and follow hostel instructions." },
  44: { summary: "Pets and animals require Management's prior written permission." },
  45: { summary: "Weapons, dangerous items, and other prohibited articles that may endanger people are not allowed, subject to applicable law.", tag: "Strict", tagTone: "critical" },
  46: { summary: "Raise complaints respectfully through Management or the designated complaints procedure." },
  47: { summary: "Breaking the rules may result in a warning, censure, authorised fine, suspension, termination of accommodation, or other appropriate discipline.", tag: "Disciplinary action", tagTone: "critical" },
  48: { summary: "Where discipline is being considered, Management may give the resident an opportunity to explain the circumstances." },
  49: { summary: "These rules do not limit Management's duty to follow applicable laws and lawful authority requirements." },
  50: { summary: "Residents must follow these regulations and other lawful Management rules for safe, orderly hostel operation." },
  51: { summary: "Management may issue reasonable additional instructions about security, health, safety, maintenance, and facilities." },
  52: { summary: "Management may take reasonable measures to protect residents, staff, visitors, and hostel property." },
};

function parseRules(guidelines: GuidelineRow[]): Rule[] {
  return guidelines.flatMap((guideline) => {
    const matches = [...guideline.content.matchAll(/(?:^|\n)(\d+)\.\s*([\s\S]*?)(?=\n\d+\.\s|$)/g)];
    return matches.map((match) => {
      const number = Number(match[1]);
      return { number, text: match[2].trim(), summary: SUMMARIES[number]?.summary ?? match[2].trim(), tag: SUMMARIES[number]?.tag, tagTone: SUMMARIES[number]?.tagTone };
    });
  }).sort((a, b) => a.number - b.number);
}

export default function Guidelines() {
  const [guidelines, setGuidelines] = useState<GuidelineRow[] | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string[]>([CATEGORIES[0].id]);

  useEffect(() => {
    api.guidelines().then(setGuidelines).catch(() => setGuidelines([]));
  }, []);

  const rules = useMemo(() => parseRules(guidelines ?? []), [guidelines]);
  const filteredCategories = useMemo(() => {
    const term = query.trim().toLowerCase();
    return CATEGORIES.map((category) => ({ ...category, rules: rules.filter((rule) => category.numbers.includes(rule.number) && (!term || `${rule.number} ${rule.summary} ${rule.text} ${category.title}`.toLowerCase().includes(term))) })).filter((category) => category.rules.length > 0);
  }, [query, rules]);
  const visibleRuleCount = filteredCategories.reduce((total, category) => total + category.rules.length, 0);

  function toggleCategory(id: string) {
    setOpen((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return (
    <main className="rules-page">
      <header className="rules-hero">
        <div className="rules-eyebrow"><BookOpen size={16} /> Executive Hostel</div>
        <h1 className="font-display">Rules made easier to follow</h1>
        <p>Find the guidance you need quickly. These eight sections turn the full hostel regulations into clear, practical reminders for everyday student life.</p>
        <button className="btn btn-outline rules-print" onClick={() => window.print()}><Printer size={15} /> Print rules</button>
      </header>

      <div className="rules-toolbar">
        <div className="rules-search"><Search size={18} aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search rules: visitors, cooking, fees..." aria-label="Search hostel rules" /></div>
        <span className="rules-result-count">{visibleRuleCount} {visibleRuleCount === 1 ? "rule" : "rules"} shown</span>
      </div>

      {!guidelines && <div className="loading-state">Loading hostel rules...</div>}
      {guidelines?.length === 0 && <div className="card rules-unavailable">Rules are currently unavailable.</div>}
      {!!guidelines?.length && <div className="rules-accordion">
        {filteredCategories.map((category) => {
          const Icon = category.icon;
          const isOpen = open.includes(category.id) || query.trim().length > 0;
          return (
            <section key={category.id} className={`rules-category ${isOpen ? "is-open" : ""}`}>
              <button type="button" className="rules-category-trigger" onClick={() => toggleCategory(category.id)} aria-expanded={isOpen}>
                <span className="rules-category-icon"><Icon size={20} aria-hidden="true" /></span>
                <span className="rules-category-copy"><strong>{category.title}</strong><small>{category.description}</small><em>{category.rules.length} {category.rules.length === 1 ? "rule" : "rules"}</em></span>
                <ChevronDown className="rules-chevron" size={20} aria-hidden="true" />
              </button>
              {isOpen && <div className="rules-category-body">{category.rules.map((rule) => <article key={rule.number} className="rule-item"><span className="rule-number">{String(rule.number).padStart(2, "0")}</span><div className="rule-copy"><div className="rule-summary-row"><h2>{rule.summary}</h2>{rule.tag && <span className={`rule-tag rule-tag-${rule.tagTone}`}>{rule.tag}</span>}</div><details><summary>View full regulation</summary><p>{rule.text}</p></details></div><Check className="rule-check" size={16} aria-hidden="true" /></article>)}</div>}
            </section>
          );
        })}
      </div>}
      {!!guidelines?.length && filteredCategories.length === 0 && <div className="empty-state rules-no-results"><Search size={22} aria-hidden="true" /><strong>No rules match “{query}”</strong><span>Try a broader search such as fees, visitors, safety, or cooking.</span></div>}
      <footer className="rules-footer"><span>Executive Hostel · Soroti University</span><span>Showing all 52 regulations in a simpler format.</span></footer>
    </main>
  );
}
