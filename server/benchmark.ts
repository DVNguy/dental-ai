// Datei: shared/benchmarks.ts oder server/benchmarks.ts

export const DENTAL_BENCHMARKS = {
  // 1. FINANZEN & KPI
  financial: {
    min_revenue_per_hour: 300.00,       // [EUR] Kritische Grenze
    target_overhead_ratio: 0.60,        // 55-65% Gesamtausgabenquote
    collection_ratio: 0.98,             // >98% Inkasso-Quote
    skonto_max: 0.03,                   // 3% Maximaler Skonto-Abzug
    break_even_crowns_cadcam: 30,       // Stück/Monat für Amortisation
    marketing_budget_percent: 0.05,     // Ca. 3-7% vom Umsatz
    min_case_acceptance: 0.75           // >75% Fallakzeptanz
  },

  // 2. STEUERN & RECHT
  tax_rates: {
    heilbehandlung: 0.00,               // § 4 Nr. 14 UStG
    zahntechnik_eigen: 0.07,            // § 12 Abs. 2 Nr. 6 UStG
    kosmetik_shop: 0.19,                // Regelsteuersatz
    bagatellgrenze_geschenke: 5.00,     // [EUR] Streuartikel-Grenze
    geschenke_steuerfrei_p_a: 50.00     // [EUR] Steuerfreie Sachbezüge
  },

  // 3. ZEIT-RICHTWERTE (STANDARD TIMES in Minuten)
  standard_times_min: {
    exam_new_patient: 60,               // 01 Untersuchung
    prophylaxis_pzr: 50,                // PZR
    prep_crown: 75,                     // Präp Krone
    endo_root_canal: 105,               // Wurzelkanal
    extraction_simple: 25,              // Extraktion
    implant_placement: 90,              // Implantation
    scan_intraoral: 5                   // Digitaler Scan
  },

  // 4. OPERATIVE SCHWELLENWERTE
  operational_limits: {
    max_waiting_time: 15,               // [Min] Kritische Grenze
    inventory_turnover: 5,              // [x/Jahr] Lagerumschlag
    no_show_rate_max: 0.05,             // <5% Ausfallquote
    hygiene_rebooking: 0.90,            // >90% Neubuchungsrate
    oee_target: 0.85                    // >85% OEE
  },

  // 5. STRUKTUR & INFRASTRUKTUR
  structural: {
    room_size_treatment_sqm: 12.0,      // Min. qm (RKI/DIN)
    room_size_prophy_sqm: 10.0,
    staff_ratio_zfa_per_dentist: 1.5,
    chairs_per_dentist: 2,
    steri_capacity_per_hour: 6
  }
};