import * as Handlebars from "handlebars";

export class PopulationsHelper {
  /**
   * Registers the populationsDisplay Handlebars helper
   */
  public static register() {
    Handlebars.registerHelper("populationsDisplay", function (str: string) {
      if (!str) return "";
      return str.replace(/;#$/, "").split(";#").filter(Boolean).join(" | ");
    });
  }
}
