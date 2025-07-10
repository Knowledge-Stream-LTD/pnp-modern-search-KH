import * as Handlebars from "handlebars";

export class NewProjectHelper {
  /**
   * Registers the isNewProject Handlebars helper
   */
  public static register() {
    Handlebars.registerHelper("isNewProject", function (createdDate: string) {
      if (!createdDate) return false;
      const created = new Date(createdDate);
      const now = new Date();
      const diff = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24); // days
      return diff < 30;
    });
  }
}
