import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

export function LanguageToggle() {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === "en" ? "de" : "en";
    i18n.changeLanguage(newLang);
  };

  return (
    <Button 
      variant="ghost" 
      size="sm" 
      onClick={toggleLanguage}
      className="w-full justify-start font-normal"
    >
      <span className="mr-2 text-lg">
        {i18n.language === "en" ? "🇩🇪" : "🇺🇸"}
      </span>
      {i18n.language === "en" ? "Switch to German" : "Switch to English"}
    </Button>
  );
}
