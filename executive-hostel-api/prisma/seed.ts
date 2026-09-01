import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const hostel = await prisma.hostel.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: { id: "00000000-0000-0000-0000-000000000001", name: "Executive Hostel" },
  });

  const main_ = await prisma.hostelSection.upsert({
    where: { hostelId_name: { hostelId: hostel.id, name: "Executive Main" } },
    update: {},
    create: { hostelId: hostel.id, name: "Executive Main" },
  });
  const annex = await prisma.hostelSection.upsert({
    where: { hostelId_name: { hostelId: hostel.id, name: "Executive Annex" } },
    update: {},
    create: { hostelId: hostel.id, name: "Executive Annex" },
  });

  const nsc = await prisma.roomType.upsert({
    where: { name: "Non-Self-Contained" },
    update: {},
    create: { name: "Non-Self-Contained" },
  });
  const sc = await prisma.roomType.upsert({
    where: { name: "Self-Contained" },
    update: {},
    create: { name: "Self-Contained" },
  });

  // Executive Main: 01-40 non-self-contained, 41-52 self-contained
  for (let i = 1; i <= 52; i++) {
    const roomNumber = String(i).padStart(2, "0");
    await prisma.room.upsert({
      where: { sectionId_roomNumber: { sectionId: main_.id, roomNumber } },
      update: {},
      create: {
        sectionId: main_.id,
        roomNumber,
        roomTypeId: i <= 40 ? nsc.id : sc.id,
        status: "vacant",
      },
    });
  }

  // Executive Annex: 01-20, all self-contained
  for (let i = 1; i <= 20; i++) {
    const roomNumber = String(i).padStart(2, "0");
    await prisma.room.upsert({
      where: { sectionId_roomNumber: { sectionId: annex.id, roomNumber } },
      update: {},
      create: { sectionId: annex.id, roomNumber, roomTypeId: sc.id, status: "vacant" },
    });
  }

  // Default fees, effective today. Change through the admin settings API later,
  // never by editing this seed and re-running it against production.
  await prisma.accommodationFee.create({
    data: { roomTypeId: nsc.id, amount: 500000, effectiveDate: new Date() },
  });
  await prisma.accommodationFee.create({
    data: { roomTypeId: sc.id, amount: 650000, effectiveDate: new Date() },
  });

  // ---------------------------------------------------------------------
  // Academic calendar - an illustrative starting year with 2 regular
  // semesters + 1 recess semester (docs update: "a year has 2 semesters
  // and one recess semester"). Adjust the label/dates via the admin
  // Academic Calendar screen once you know your real term dates - this is
  // just enough structure to exist so students can be enrolled and
  // semester-scoped fees/payments work immediately after seeding.
  // ---------------------------------------------------------------------
  const year = await prisma.academicYear.upsert({
    where: { label: "2025/2026" },
    update: {},
    create: { label: "2025/2026" },
  });
  await prisma.semester.upsert({
    where: { id: "10000000-0000-0000-0000-000000000001" },
    update: {},
    create: { id: "10000000-0000-0000-0000-000000000001", academicYearId: year.id, label: "Semester 1", type: "regular" },
  });
  await prisma.semester.upsert({
    where: { id: "10000000-0000-0000-0000-000000000002" },
    update: {},
    create: { id: "10000000-0000-0000-0000-000000000002", academicYearId: year.id, label: "Semester 2", type: "regular" },
  });
  await prisma.semester.upsert({
    where: { id: "10000000-0000-0000-0000-000000000003" },
    update: {},
    create: { id: "10000000-0000-0000-0000-000000000003", academicYearId: year.id, label: "Recess", type: "recess" },
  });
  // No recess-specific AccommodationFee is seeded on purpose - until the
  // admin configures one via POST /fees scoped to the recess semester,
  // recess residents are charged the same default room-type fee above.
  // That's the intended fallback behavior (getCurrentFeeForStudent), not
  // a bug - see payment.service.ts.

  // ---------------------------------------------------------------------
  // Hostel Guidelines - transcribed from the hostel's own uploaded Rules
  // and Regulations PDF (docs Section 41 explicitly says: don't invent
  // rules, provide an editor for the real ones - these ARE the real ones).
  // The source PDF was a scanned/OCR'd document with some page-rotation
  // artifacts; this transcription was cleaned up for readability but
  // should be spot-checked against the original PDF for exact wording
  // before relying on it for a disciplinary decision.
  // ---------------------------------------------------------------------
  const guidelines: { category: string; content: string }[] = [
    {
      category: "Admission and Hostel Fees",
      content: [
        "1. Admission to the Hostel shall be at the discretion of Management.",
        "2. No resident shall be admitted to the Hostel before paying at least 50% of the applicable Hostel fees.",
        "3. All outstanding Hostel fees shall be cleared within two (2) months from the date of admission. This requirement may be reconsidered for Government-sponsored students, subject to approval by Management.",
        "4. A resident with outstanding Hostel fees may be subject to restriction, suspension or termination of accommodation in accordance with Management procedures.",
        "5. Residents shall not remove personal property from the Hostel in circumstances of accommodation restriction due to outstanding fees, subject to applicable Hostel procedures where Management has lawfully restricted such removal.",
      ].join("\n"),
    },
    {
      category: "Conduct and General Behaviour",
      content: [
        "6. All residents shall conduct themselves with courtesy, respect and decorum and shall not engage in behaviour that threatens, intimidates, harasses or unreasonably disturbs other residents, staff or visitors.",
        "7. Fighting, threats, bullying, harassment, vandalism, disorderly conduct and abusive or offensive behaviour are prohibited.",
        "8. Decent and appropriate dressing and behaviour is required of all residents.",
        "9. Residents shall comply with lawful instructions issued by Management and staff in relation to Hostel safety, security, cleanliness and orderly administration.",
      ].join("\n"),
    },
    {
      category: "Smoking, Alcohol, Narcotics and Prohibited Substances",
      content: [
        "10. Smoking, consumption or possession of alcohol, narcotic drugs or other prohibited substances is strictly prohibited in and around the Hostel premises.",
        "11. Any conduct associated with prohibited substances that threatens the safety, security or wellbeing of residents may result in disciplinary action and, where appropriate, referral to relevant authorities.",
      ].join("\n"),
    },
    {
      category: "Cleanliness, Hygiene and Care of Property",
      content: [
        "12. Residents shall keep their rooms, shared facilities and the Hostel compound clean and orderly.",
        "13. Defacing, damaging, removing or misusing walls, equipment, furniture, fixtures or other Hostel property is strictly prohibited.",
        "14. A resident responsible for damage to Hostel property may be required to meet the reasonable cost of repair or replacement, subject to Management's procedures.",
        "15. Residents shall dispose of waste properly and observe all hygiene requirements communicated by Management.",
      ].join("\n"),
    },
    {
      category: "Electrical and Fire Safety",
      content: [
        "16. Residents must switch off lights and all electrical equipment before leaving their rooms.",
        "17. Electric stoves, heaters and other high-power appliances shall not be used in rooms except in areas specifically designated by Management.",
        "18. Tampering with electrical installations, sockets, wiring, fire equipment or other safety installations is strictly prohibited.",
        "19. Open flames, candles or other activities that create an unreasonable fire risk are prohibited unless expressly authorised by Management.",
        "20. Residents shall familiarise themselves with emergency exits and immediately report fires, electrical faults, gas leaks or other emergencies to Management or the appropriate emergency contact.",
      ].join("\n"),
    },
    {
      category: "Personal Belongings and Security",
      content: [
        "21. Management and Hostel staff shall not be responsible for loss, theft or damage to residents' personal belongings except to the extent required by applicable law.",
        "22. Residents are responsible for securing their personal property and should avoid keeping large amounts of cash or other valuables in their rooms.",
        "23. Loss, theft, damage or suspicious activity shall be reported to Management promptly.",
        "24. Residents shall not take, use or retain another resident's property without permission.",
      ].join("\n"),
    },
    {
      category: "Visitors",
      content: [
        "25. Visitors are permitted only during visiting hours and shall not remain in the Hostel or rooms beyond 9:00 p.m.",
        "26. Overnight visitors are strictly prohibited unless expressly authorised in writing by Management.",
        "27. Visitors must comply with Hostel security and registration procedures.",
        "28. An invited visitor shall remain only in the room or designated area of the resident who invited them and shall not access other residents' rooms without permission.",
        "29. The resident who invites a visitor is responsible for the visitor's conduct and compliance with Hostel rules.",
      ].join("\n"),
    },
    {
      category: "Privacy and Access to Rooms",
      content: [
        "30. Residents shall not enter another resident's room without permission, except where access is authorised by Management or required in an emergency.",
        "31. Management or authorised staff may access rooms for maintenance, inspection, safety, emergency response or other legitimate Hostel purposes, subject to reasonable notice where practicable.",
      ].join("\n"),
    },
    {
      category: "Noise and Quiet Hours",
      content: [
        "32. Strict silence shall be observed from 11:00 p.m. to 5:30 a.m.",
        "33. At all times, residents shall ensure that music, television, loud conversations and other noise are not unreasonably audible outside their rooms.",
        "34. Parties or other activities likely to disturb other residents are prohibited unless expressly authorised by Management.",
      ].join("\n"),
    },
    {
      category: "Maintenance and Complaints",
      content: [
        "35. Complaints or reports concerning electrical equipment, plumbing, furniture, sanitation, security or other Hostel facilities shall be promptly entered in the Complaints Book or reported through the procedure designated by Management.",
        "36. Residents shall not attempt unauthorised repairs or alterations to electrical, plumbing or other Hostel installations.",
      ].join("\n"),
    },
    {
      category: "Keys, Access and Security",
      content: [
        "37. Residents shall safeguard Hostel keys, access cards and other security devices issued to them.",
        "38. Loss of a key or access device shall be reported immediately to Management. Any applicable replacement cost shall be communicated by Management.",
        "39. Residents shall not duplicate, lend, transfer or misuse Hostel keys or access devices without authorisation.",
      ].join("\n"),
    },
    {
      category: "Cooking, Food and Shared Facilities",
      content: [
        "40. Cooking shall only be undertaken in areas designated by Management.",
        "41. Residents shall keep cooking and shared facilities clean after use and shall not leave cooking appliances unattended.",
        "42. Food shall be stored and disposed of in a manner that maintains hygiene and prevents pests.",
      ].join("\n"),
    },
    {
      category: "Vehicles, Parking, Pets and Dangerous Items",
      content: [
        "43. Vehicles shall be parked only in designated areas and in accordance with Hostel instructions.",
        "44. Pets or animals shall not be kept in the Hostel without prior written permission from Management.",
        "45. Residents shall not possess or bring into the Hostel any weapon, dangerous item or other prohibited article that may endanger residents, staff or visitors, subject to applicable law.",
      ].join("\n"),
    },
    {
      category: "Complaints, Discipline and Enforcement",
      content: [
        "46. Residents shall raise complaints respectfully through Management or the designated complaints procedure.",
        "47. Failure to comply with these Rules and Regulations may result in a warning, censure, reasonable fine where authorised, suspension of Hostel privileges, termination of accommodation, or other appropriate disciplinary action, depending on the nature and seriousness of the violation.",
        "48. Where disciplinary action is contemplated, Management may give the resident an opportunity to explain the circumstances, consistent with applicable law and Hostel procedures.",
        "49. Nothing in these rules limits Management's obligation to comply with applicable laws or lawful requirements of competent authorities.",
      ].join("\n"),
    },
    {
      category: "General Management Authority",
      content: [
        "50. Residents shall be governed by these Rules and Regulations and any lawful Management rules issued for the safe and orderly operation of the Hostel.",
        "51. Management may issue reasonable supplementary instructions concerning security, health, safety, maintenance and use of Hostel facilities.",
        "52. Management reserves the right to take reasonable measures necessary to protect residents, staff, visitors and Hostel property.",
      ].join("\n"),
    },
  ];

  for (const g of guidelines) {
    const existing = await prisma.hostelGuideline.findFirst({ where: { category: g.category } });
    if (!existing) {
      await prisma.hostelGuideline.create({ data: g });
    }
  }

  console.log(`Seeded: 1 hostel, 2 sections, 72 rooms, 2 room types, 2 fee records, 1 academic year (3 semesters), ${guidelines.length} guideline categories.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
