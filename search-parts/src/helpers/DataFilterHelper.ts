import { isEmpty } from "@microsoft/sp-lodash-subset";
import {
  IDataFilter,
  IDataFilterConfiguration,
  FilterType,
  IDataFilterResult,
  FilterComparisonOperator,
} from "@pnp/modern-search-extensibility";
import { BuiltinTokenNames } from "../services/tokenService/TokenService";

export class DataFilterHelper {
  /**
   * Returns the configuration for a specific filter
   * @param filter the filter
   * @param filtersConfiguration the filtes configuraton
   */
  public static getConfigurationForFilter(
    filter: IDataFilter | IDataFilterResult,
    filtersConfiguration: IDataFilterConfiguration[]
  ): IDataFilterConfiguration {
    // Get the configuration for this filter
    let filterConfiguration: IDataFilterConfiguration = undefined;
    const filterConfigIdx = filtersConfiguration
      .map((configuration) => {
        return configuration.filterName;
      })
      .indexOf(filter.filterName);

    if (filterConfigIdx !== -1) {
      filterConfiguration = filtersConfiguration[filterConfigIdx];
    }

    return filterConfiguration;
  }

  /**
   * Returns the selected filters by type
   * @param filters the list of selected filters
   * @param type the filter type to get
   * @param filtersConfiguration to filters configuration
   */
  public static getSelectedFilterValuesByType(
    filters: IDataFilter[],
    type: FilterType,
    filtersConfiguration: IDataFilterConfiguration[]
  ): string[] {
    let selectedValues: string[] = [];

    filters.forEach((filter) => {
      const configuration = this.getConfigurationForFilter(
        filter,
        filtersConfiguration
      );
      if (configuration && configuration.type === type) {
        selectedValues = selectedValues.concat(
          filter.values.map((value) => value.value)
        );
      }
    });

    return selectedValues.sort();
  }

  /**
   * Determines if filters have been applied via tokens in the string
   * @param selectedFilters the current selected filters
   * @param inputString the string with tokens
   */
  public static getAppliedFiltersFromTokens(
    selectedFilters: IDataFilter[],
    inputString: string
  ): IDataFilter[] {
    const tokens = inputString.match(/\{[^\{]*?\}/gi);
    let selectedFiltersInTokens: IDataFilter[] = [];

    if (tokens !== null && tokens.length > 0) {
      tokens.forEach((token) => {
        // Take the expression inside curly brackets
        const tokenName = token.substr(1).slice(0, -1);
        const tokenParts = tokenName.split(".");

        // If contains 'filters.XXX'
        if (
          tokenName.indexOf(BuiltinTokenNames.filters) !== -1 &&
          tokenParts.length > 1
        ) {
          // See if the filter name is selected. 'tokenParts[1]' should be the filter name
          const selectedFiltersByName = selectedFilters.filter(
            (selectedFilter) => selectedFilter.filterName === tokenParts[1]
          );
          const alreadyAddedFitlers = selectedFiltersInTokens.filter(
            (selectedFiltersInToken) =>
              selectedFiltersInToken.filterName === tokenParts[1]
          );

          if (
            selectedFiltersByName.length > 0 &&
            alreadyAddedFitlers.length === 0
          ) {
            selectedFiltersInTokens.push(selectedFilters[0]);
          }
        }
      });
    }

    return selectedFiltersInTokens;
  }

  /**
   * Build the refinement condition in FQL format
   * @param selectedFilters The selected filter array
   * @param moment The moment.js instance to resolve dates
   * @param encodeTokens If true, encodes the taxonomy refinement tokens in UTF-8 to work with GET requests. Javascript encodes natively in UTF-16 by default.
   */
  public static buildKqlRefinementString(
    selectedFilters: IDataFilter[],
    moment: any
  ): string {
    let refinementQueryConditions: string[] = [];
    selectedFilters.forEach((filter) => {
      const { filterName, values } = filter;

      if (values && values.length > 0) {
        let startDate = null;
        let endDate = null;
        let dateOperator = null;
        const fieldValues = values
          .map((refinement) => {
            if (moment(refinement.value, moment.ISO_8601, true).isValid()) {
              if (
                !startDate &&
                (refinement.operator === FilterComparisonOperator.Geq ||
                  refinement.operator === FilterComparisonOperator.Gt)
              ) {
                dateOperator = ">=";
                startDate = refinement.value;
              }

              if (
                !endDate &&
                (refinement.operator === FilterComparisonOperator.Lt ||
                  refinement.operator === FilterComparisonOperator.Leq)
              ) {
                dateOperator = "<";
                endDate = refinement.value;
              }
            } else {
              return `${filterName}:"${refinement.name}"`;
            }
          })
          .filter((c) => c);

        if (startDate && endDate) {
          refinementQueryConditions.push(
            `${filter.filterName}:${startDate}..${endDate}`
          );
        } else if (startDate) {
          refinementQueryConditions.push(
            `${filter.filterName}${dateOperator}${startDate}`
          );
        } else if (endDate) {
          refinementQueryConditions.push(
            `${filter.filterName}${dateOperator}${endDate}`
          );
        } else {
          const joinedFieldValues =
            fieldValues.length > 1
              ? fieldValues.join(` ${filter.operator === "or" ? "OR" : "AND"} `)
              : fieldValues[0];
          refinementQueryConditions.push(`(${joinedFieldValues})`);
        }
      }
    });

    return refinementQueryConditions.join(" OR "); // only used when building aggregation with OR between filters
  }

  /**
   * Build the refinement condition in FQL format
   * @param selectedFilters The selected filter array
   * @param moment The moment.js instance to resolve dates
   * @param encodeTokens If true, encodes the taxonomy refinement tokens in UTF-8 to work with GET requests. Javascript encodes natively in UTF-16 by default.
   */
  public static buildFqlRefinementString(
    selectedFilters: IDataFilter[],
    moment: any,
    encodeTokens?: boolean
  ): string[] {
    let refinementQueryConditions: string[] = [];

    selectedFilters.forEach((filter) => {
      let operator: any = filter.operator;

      // --- CUSTOM LOGIC FOR NUMERIC RANGE ---
      // If exactly two values: one Geq, one Leq, both numbers, treat as range
      if (
        filter.values.length === 2 &&
        filter.values.some(
          (v) => v.operator === FilterComparisonOperator.Geq
        ) &&
        filter.values.some(
          (v) => v.operator === FilterComparisonOperator.Leq
        ) &&
        filter.values.every((v) => /^-?\d+(\.\d+)?$/.test(v.value))
      ) {
        const from = filter.values.find(
          (v) => v.operator === FilterComparisonOperator.Geq
        )?.value;
        const to = filter.values.find(
          (v) => v.operator === FilterComparisonOperator.Leq
        )?.value;
        if (from && to) {
          refinementQueryConditions.push(
            `${filter.filterName}:range(${from},${to})`
          );
          return;
        }
      }
      // If only 'from' (Geq) is set, filter by greater than or equal
      if (
        filter.values.length === 1 &&
        filter.values[0].operator === FilterComparisonOperator.Geq &&
        /^-?\d+(\.\d+)?$/.test(filter.values[0].value)
      ) {
        const from = filter.values[0].value;
        refinementQueryConditions.push(
          `${filter.filterName}:range(${from},max)`
        );
        return;
      }
      // If only 'to' (Leq) is set, filter by less than or equal
      if (
        filter.values.length === 1 &&
        filter.values[0].operator === FilterComparisonOperator.Leq &&
        /^-?\d+(\.\d+)?$/.test(filter.values[0].value)
      ) {
        const to = filter.values[0].value;
        refinementQueryConditions.push(`${filter.filterName}:range(min,${to})`);
        return;
      }

      // Multi values
      if (filter.values.length > 1) {
        let startDate = null;
        let endDate = null;
        let startBehaviour = "GE";
        let endBehavior = "LE";

        // A refiner can have multiple values selected in a multi or mon multi selection scenario
        // The correct operator is determined by the refiner display template according to its behavior
        const conditions = filter.values
          .map((filterValue) => {
            let value = filterValue.value;

            if (moment(value, moment.ISO_8601, true).isValid()) {
              if (
                !startDate &&
                (filterValue.operator === FilterComparisonOperator.Geq ||
                  filterValue.operator === FilterComparisonOperator.Gt)
              ) {
                startDate = value;
                startBehaviour =
                  filterValue.operator === FilterComparisonOperator.Gt
                    ? "GT"
                    : "GE";
              }

              if (
                !endDate &&
                (filterValue.operator === FilterComparisonOperator.Lt ||
                  filterValue.operator === FilterComparisonOperator.Leq)
              ) {
                endDate = value;
                endBehavior =
                  filterValue.operator === FilterComparisonOperator.Lt
                    ? "LT"
                    : "LE";
              }
            }

            // If the value is null or undefined, we replace it by the FQL expression string('')
            // Otherwise the query syntax won't be vaild resuting of to an HTTP 500
            if (isEmpty(value)) {
              value = "string('')";
            }

            if (/RefinableYesNo/.test(filter.filterName)) {
              value = DataFilterHelper.fixRefinableYesNoFilter(filter, value);
            }

            // Enclose the expression with quotes if the value contains spaces, or number only
            if (
              (/\s/.test(value) && value.indexOf("range") === -1) ||
              (filter.filterName.indexOf("RefinableString") &&
                /^\d+$/.test(value))
            ) {
              value = `"${value}"`;
            }

            return /ǂǂ/.test(value) && encodeTokens
              ? encodeURIComponent(value)
              : value;
          })
          .filter((c) => c);

        if (startDate && endDate) {
          refinementQueryConditions.push(
            `${filter.filterName}:range(${startDate},${endDate},from="${startBehaviour}",to="${endBehavior}")`
          );
        } else {
          refinementQueryConditions.push(
            `${filter.filterName}:${operator}(${conditions.join(",")})`
          );
        }
      } else {
        // Single value
        if (filter.values.length === 1) {
          const filterValue = filter.values[0];

          // See https://sharepoint.stackexchange.com/questions/258081/how-to-hex-encode-refiners/258161
          let refinementToken =
            /ǂǂ/.test(filterValue.value) && encodeTokens
              ? encodeURIComponent(filterValue.value)
              : filterValue.value;

          // https://docs.microsoft.com/en-us/sharepoint/dev/general-development/fast-query-language-fql-syntax-reference#fql_range_operator
          if (moment(refinementToken, moment.ISO_8601, true).isValid()) {
            if (
              filterValue.operator === FilterComparisonOperator.Gt ||
              filterValue.operator === FilterComparisonOperator.Geq
            ) {
              refinementToken = `range(${refinementToken},max)`;
            }

            // Ex: scenario ('older than a year')
            if (
              filterValue.operator === FilterComparisonOperator.Leq ||
              filterValue.operator === FilterComparisonOperator.Lt
            ) {
              refinementToken = `range(min,${refinementToken})`;
            }
          }

          // If the value is null or undefined, we replace it by the FQL expression string('')
          // Otherwise the query syntax won't be vaild resuting of to an HTTP 500
          if (isEmpty(refinementToken)) {
            refinementToken = "string('')";
          }

          if (/RefinableYesNo/.test(filter.filterName)) {
            refinementToken = DataFilterHelper.fixRefinableYesNoFilter(
              filter,
              refinementToken
            );
          }

          // Enclose the expression with quotes if the value contains spaces
          if (
            /\s/.test(refinementToken) &&
            refinementToken.indexOf("range") === -1
          ) {
            refinementToken = `"${refinementToken}"`;
          }

          refinementQueryConditions.push(
            `${filter.filterName}:${refinementToken}`
          );
        }
      }
    });

    return refinementQueryConditions;
  }

  private static fixRefinableYesNoFilter(filter: IDataFilter, value: string) {
    if (value === '"ǂǂ54727565"') {
      value = "true";
    } else if (value === '"ǂǂ46616c7365"') {
      value = "false";
    }
    return value;
  }
}
