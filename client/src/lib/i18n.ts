import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  en: {
    translation: {
      "app.title": "PraxisFlow AI",
      "nav.dashboard": "Dashboard",
      "nav.layout": "Practice Layout",
      "nav.staff": "Staff & Resources",
      "nav.simulation": "Simulation",
      "nav.settings": "Settings",
      
      "dashboard.title": "Practice Overview",
      "dashboard.subtitle": "Current simulation status and performance metrics.",
      "dashboard.runSim": "Run New Simulation",
      "dashboard.liveView": "Live Floor View",
      "dashboard.liveViewDesc": "Real-time simulation preview.",
      
      "stats.efficiency": "Efficiency Index",
      "stats.harmony": "Harmony Score",
      "stats.waitTime": "Avg Wait Time",
      "stats.capacity": "Patient Capacity",
      "stats.efficiencyDesc": "+2.5% from last simulation",
      "stats.harmonyDesc": "Staff stress levels low",
      "stats.waitTimeDesc": "-3 min optimization",
      "stats.capacityDesc": "Using 85% of resources",
      
      "chart.title": "Daily Performance Metrics",
      "chart.efficiency": "Efficiency Index",
      "chart.harmony": "Harmony Score",

      "layout.title": "Practice Layout Editor",
      "layout.subtitle": "Drag and drop to optimize patient flow.",
      "layout.reset": "Reset",
      "layout.save": "Save Layout",
      "layout.roomTypes": "Room Types",
      "layout.tipTitle": "Optimization Tip",
      "layout.tipText": "Placing the Waiting Room closer to Exam Rooms increases Efficiency Score by reducing patient travel time.",
      
      "staff.title": "Staff Management",
      "staff.subtitle": "Monitor stress levels and assign roles to optimize harmony.",
      "staff.add": "Add Staff Member",
      "staff.efficiency": "Efficiency",
      "staff.stress": "Stress Level",
      
      "sim.title": "Scenario Simulation",
      "sim.subtitle": "Run complex scenarios to test efficiency and harmony under pressure.",
      "sim.engineReady": "Simulation Engine Ready",
      "sim.params": "Simulation Parameters",
      "sim.paramsDesc": "Adjust variables in real-time",
      "sim.patientVolume": "Patient Volume",
      "sim.speed": "Simulation Speed",
      "sim.randomEvents": "Random Events",
      "sim.randomEventsDesc": "Includes staff sickness, emergency walk-ins, and equipment failure.",
      "sim.activeScenario": "Active Scenario",
      "sim.scenarioName": "Flu Season Peak",
      "sim.scenarioDesc": "High patient influx with respiratory symptoms. Staff stress accumulation increased by 20%.",

      "rooms.reception": "Reception",
      "rooms.waiting": "Waiting Room",
      "rooms.exam": "Exam Room",
      "rooms.lab": "Laboratory",
      "rooms.office": "Doctor Office",

      "editor.properties": "Properties",
      "editor.width": "Width",
      "editor.height": "Height",
      "editor.delete": "Delete Room",
      "editor.rotate": "Rotate",
      "editor.noSelection": "Select a room to edit",
      "editor.selected": "Selected"
    }
  },
  de: {
    translation: {
      "app.title": "PraxisFlow AI",
      "nav.dashboard": "Dashboard",
      "nav.layout": "Praxis-Layout",
      "nav.staff": "Personal & Ressourcen",
      "nav.simulation": "Simulation",
      "nav.settings": "Einstellungen",
      
      "dashboard.title": "Praxis-Übersicht",
      "dashboard.subtitle": "Aktueller Simulationsstatus und Leistungskennzahlen.",
      "dashboard.runSim": "Neue Simulation starten",
      "dashboard.liveView": "Live-Grundriss",
      "dashboard.liveViewDesc": "Echtzeit-Simulationsvorschau.",
      
      "stats.efficiency": "Effizienz-Index",
      "stats.harmony": "Harmonie-Score",
      "stats.waitTime": "Ø Wartezeit",
      "stats.capacity": "Patientenkapazität",
      "stats.efficiencyDesc": "+2,5% seit letzter Simulation",
      "stats.harmonyDesc": "Personalstress niedrig",
      "stats.waitTimeDesc": "-3 Min Optimierung",
      "stats.capacityDesc": "85% Ressourcenauslastung",
      
      "chart.title": "Tägliche Leistungskennzahlen",
      "chart.efficiency": "Effizienz-Index",
      "chart.harmony": "Harmonie-Score",

      "layout.title": "Praxis-Layout Editor",
      "layout.subtitle": "Drag & Drop zur Optimierung des Patientenflusses.",
      "layout.reset": "Zurücksetzen",
      "layout.save": "Layout speichern",
      "layout.roomTypes": "Raumtypen",
      "layout.tipTitle": "Optimierungs-Tipp",
      "layout.tipText": "Die Platzierung des Wartezimmers in der Nähe der Behandlungsräume erhöht den Effizienzwert durch kürzere Wege.",
      
      "staff.title": "Personalmanagement",
      "staff.subtitle": "Überwachung der Stresslevel und Rollenzuweisung zur Harmonieoptimierung.",
      "staff.add": "Mitarbeiter hinzufügen",
      "staff.efficiency": "Effizienz",
      "staff.stress": "Stresslevel",
      
      "sim.title": "Szenario-Simulation",
      "sim.subtitle": "Komplexe Szenarien testen für Effizienz und Harmonie unter Druck.",
      "sim.engineReady": "Simulations-Engine Bereit",
      "sim.params": "Simulations-Parameter",
      "sim.paramsDesc": "Variablen in Echtzeit anpassen",
      "sim.patientVolume": "Patientenaufkommen",
      "sim.speed": "Simulationsgeschwindigkeit",
      "sim.randomEvents": "Zufallsereignisse",
      "sim.randomEventsDesc": "Inklusive Personalausfall, Notfälle und Geräteausfall.",
      "sim.activeScenario": "Aktives Szenario",
      "sim.scenarioName": "Grippewelle",
      "sim.scenarioDesc": "Hoher Patientenzustrom mit Atemwegssymptomen. Stressakkumulation beim Personal um 20% erhöht.",

      "rooms.reception": "Empfang",
      "rooms.waiting": "Wartezimmer",
      "rooms.exam": "Behandlungsraum",
      "rooms.lab": "Labor",
      "rooms.office": "Arztzimmer",

      "editor.properties": "Eigenschaften",
      "editor.width": "Breite",
      "editor.height": "Höhe",
      "editor.delete": "Raum löschen",
      "editor.rotate": "Drehen",
      "editor.noSelection": "Raum auswählen zum Bearbeiten",
      "editor.selected": "Ausgewählt"
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "en", // default language
    interpolation: {
      escapeValue: false // react already safes from xss
    }
  });

export default i18n;
