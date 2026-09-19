import type { Lang } from "../i18n/catalog";

export interface ActionCard {
  id: string;
  title: string;
  action: string;
  timing: string;
  ownerHint: string;
  urgency: "routine" | "advisory" | "urgent" | "emergency";
}

export const playbooks: Record<
  Lang,
  Record<"Low" | "Moderate" | "High" | "Extreme", ActionCard[]>
> = {
  id: {
    Low: [
      {
        id: "low-1",
        title: "Pemantauan Rutin Posko",
        action: "Lanjutkan pencatatan data harian sensor dan inspeksi berkala pada sekat kanal.",
        timing: "Setiap 3-5 hari",
        ownerHint: "Tim Patroli Rutin",
        urgency: "routine",
      },
      {
        id: "low-2",
        title: "Pengecekan Logistik Pencegahan",
        action: "Periksa kelayakan pompa portabel dan sumber air cadangan untuk kesiapan berkala.",
        timing: "Mingguan",
        ownerHint: "Kepala Logistik Lapangan",
        urgency: "routine",
      },
    ],
    Moderate: [
      {
        id: "mod-1",
        title: "Tingkatkan Kewaspadaan Patroli",
        action:
          "Tingkatkan frekuensi patroli darat di area gambut rawan dan periksa kelembaban serasah.",
        timing: "Dalam 48-72 jam",
        ownerHint: "Komandan Regu Patroli",
        urgency: "advisory",
      },
      {
        id: "mod-2",
        title: "Inspeksi Muka Air Sekat Kanal",
        action:
          "Verifikasi ketinggian air di hulu sekat kanal agar tetap berada di atas batas kritis -0.4 m.",
        timing: "Dalam 48 jam",
        ownerHint: "Koordinator Tata Air Gambut",
        urgency: "advisory",
      },
    ],
    High: [
      {
        id: "high-1",
        title: "Siagakan Regu Pemadam Cepat",
        action:
          "Instruksikan tim pemadam standby penuh dengan perlengkapan pemadaman darat dan selang jinjing.",
        timing: "Segera (< 24 jam)",
        ownerHint: "Kepala Operasi Manggala Agni / BPBD",
        urgency: "urgent",
      },
      {
        id: "high-2",
        title: "Pemeriksaan dan Pembasahan Sekat Bakar",
        action:
          "Pastikan jalur sekat bakar bersih dari serasah kering dan lakukan pembasahan preventif.",
        timing: "Dalam 24-48 jam",
        ownerHint: "Masyarakat Peduli Api (MPA)",
        urgency: "urgent",
      },
      {
        id: "high-3",
        title: "Himbauan Pembatasan Aktivitas Api",
        action: "Sosialisasikan larangan membakar sampah atau lahan di sekitar kawasan penyangga.",
        timing: "Segera",
        ownerHint: "Aparat Desa & Polsek Setempat",
        urgency: "urgent",
      },
    ],
    Extreme: [
      {
        id: "ext-1",
        title: "Mobilisasi Pasukan Tanggap Darurat Penuh",
        action:
          "Kerahkan regu pemadam gabungan ke zona rawan; siapkan suplai helikopter water-bombing jika diperlukan.",
        timing: "Segera (< 12 jam)",
        ownerHint: "Satgas Karhutla / BPBD Provinsi",
        urgency: "emergency",
      },
      {
        id: "ext-2",
        title: "Pemberlakuan Larangan Total Membakar",
        action:
          "Terapkan sanksi tegas larangan menyalakan api di seluruh konsesi dan kawasan gambut.",
        timing: "Berlaku seketika",
        ownerHint: "Satuan Penegakan Hukum & Pemda",
        urgency: "emergency",
      },
      {
        id: "ext-3",
        title: "Operasi Pembasahan Cepat (Rewetting Darurat)",
        action:
          "Buka pintu suplesi air atau operasikan pompa bertekanan tinggi untuk merendam kembali gambut kering.",
        timing: "Dalam 12-24 jam",
        ownerHint: "Pengelola Restorasi Gambut",
        urgency: "emergency",
      },
    ],
  },
  en: {
    Low: [
      {
        id: "low-1",
        title: "Routine Station Monitoring",
        action: "Maintain baseline sensor monitoring and routine weekly canal block inspections.",
        timing: "Every 3-5 days",
        ownerHint: "Routine Patrol Crew",
        urgency: "routine",
      },
      {
        id: "low-2",
        title: "Equipment Maintenance",
        action: "Verify readiness of portable water pumps and retention basin inventories.",
        timing: "Weekly",
        ownerHint: "Field Logistics Lead",
        urgency: "routine",
      },
    ],
    Moderate: [
      {
        id: "mod-1",
        title: "Elevated Watch Patrols",
        action:
          "Increase field surveillance in exposed peat zones and check surface leaf-litter dryness.",
        timing: "Within 48-72h",
        ownerHint: "Patrol Squad Leader",
        urgency: "advisory",
      },
      {
        id: "mod-2",
        title: "Canal Water Level Audit",
        action:
          "Inspect upstream water depths at key canal dams to maintain groundwater above -0.4 m threshold.",
        timing: "Within 48h",
        ownerHint: "Hydrology Coordinator",
        urgency: "advisory",
      },
    ],
    High: [
      {
        id: "high-1",
        title: "Prepare Rapid Response Teams",
        action:
          "Put fire suppression squads on high alert with portable pumps and pre-connected hoses.",
        timing: "Immediate (< 24h)",
        ownerHint: "Operations Commander",
        urgency: "urgent",
      },
      {
        id: "high-2",
        title: "Reinforce Fuel Breaks & Wetting",
        action:
          "Clear dried biomass along perimeter firebreaks and initiate localized pre-wetting.",
        timing: "Within 24-48h",
        ownerHint: "Community Fire Brigade (MPA)",
        urgency: "urgent",
      },
      {
        id: "high-3",
        title: "Public Burning Restrictions",
        action:
          "Issue community advisories restricting outdoor ignition and agricultural clearing.",
        timing: "Immediate",
        ownerHint: "Local Administration",
        urgency: "urgent",
      },
    ],
    Extreme: [
      {
        id: "ext-1",
        title: "Mobilize Emergency Operations",
        action:
          "Deploy inter-agency response units to critical zones; coordinate aerial water-bombing assets if needed.",
        timing: "Immediate (< 12h)",
        ownerHint: "Regional Disaster Agency (BPBD)",
        urgency: "emergency",
      },
      {
        id: "ext-2",
        title: "Enforce Total Burning Ban",
        action:
          "Strictly enforce prohibitions against open burning across all concessions and community lands.",
        timing: "Immediate enforcement",
        ownerHint: "Law Enforcement & Forestry Police",
        urgency: "emergency",
      },
      {
        id: "ext-3",
        title: "Emergency Canal Rewetting",
        action: "Divert water supplies into drainage canals to recharge desiccated peat layers.",
        timing: "Within 12-24h",
        ownerHint: "Peatland Restoration Managers",
        urgency: "emergency",
      },
    ],
  },
};
