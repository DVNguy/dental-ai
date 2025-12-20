import "react-i18next";

declare module "react-i18next" {
  interface CustomTypeOptions {
    allowObjectInHTMLChildren: true;
  }
}

declare module "i18next" {
  interface CustomTypeOptions {
    returnNull: false;
    defaultNS: "translation";
  }

  interface TFunction {
    (key: string, options?: Record<string, unknown>): string;
  }
}
