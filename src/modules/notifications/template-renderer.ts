/**
 * This module provides functionality to render templates with dynamic data.
 * It allows for the replacement of placeholders in the template with actual values provided in a data object.
 * The placeholders are defined using double curly braces (e.g., {{ variableName }}),
 * and the module supports nested properties using dot notation (e.g., {{ user.name }}).
 * The module ensures that all required variables are present in the data object and throws an error if any variable is missing.
 * The module also validates that the provided data is an object and not null or an array.
 */
import { AppError } from "../../shared/errors/app-error.js";

const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

type TemplateData = Record<string, unknown>;

/**
 *  Retrieves the value from the data object based on the provided path.
 * @param data TemplateData : The data object containing the values to be used in the template.
 * @param path string : The path to the value in the data object, using dot notation for nested properties.
 * @returns The value at the specified path, or undefined if not found.
 */
function getValue(data: TemplateData, path: string): unknown {
  const parts = path.split(".");

  let value: unknown = data;

  for (const part of parts) {
    if (typeof value !== "object" || value === null || !(part in value)) {
      return undefined;
    }

    value = (value as Record<string, unknown>)[part];
  }

  return value;
}

/**
 * Renders the template by replacing placeholders with actual values from the data object.
 * @param template string : The template string containing placeholders.
 * @param data TemplateData : The data object containing the values to replace the placeholders.
 * @returns The rendered string with placeholders replaced by actual values.
 * @throws AppError if any required variable is missing in the data object.
 */
function renderText(template: string, data: TemplateData): string {
  return template.replace(VARIABLE_PATTERN, (match, variable: string) => {
    const value = getValue(data, variable);

    if (value === undefined || value === null) {
      throw new AppError(
        "TEMPLATE_VARIABLE_MISSING",
        `Template variable "${variable}" is missing`,
        400,
      );
    }

    return String(value);
  });
}

/**
 * This function renders the subject and body of a notification template using the provided data.
 * It replaces placeholders in the template with actual values from the data object.
 * The function ensures that all required variables are present in the data object and throws an error if any variable is missing.
 * It also validates that the provided data is an object and not null or an array.
 * @param body string : The body of the notification template.
 * @param subject string | null : The subject of the notification template.
 * @param data TemplateData : The data object containing the values to replace the placeholders.
 * @returns An object containing the rendered subject and body.
 */
export function renderTemplate(
  body: string,
  subject: string | null,
  data: unknown,
) {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new AppError(
      "INVALID_TEMPLATE_DATA",
      "Template data must be an object",
      400,
    );
  }

  const templateData = data as TemplateData;

  return {
    subject: subject ? renderText(subject, templateData) : null,

    body: renderText(body, templateData),
  };
}
