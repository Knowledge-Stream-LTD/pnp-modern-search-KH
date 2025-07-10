import * as React from "react";
import {
  BaseWebComponent,
  FilterComparisonOperator,
  IDataFilterInfo,
  IDataFilterValueInfo,
  IDataFilterInternal,
  ExtensibilityConstants,
} from "@pnp/modern-search-extensibility";
import * as ReactDOM from "react-dom";
import { MessageBar, MessageBarType } from "@fluentui/react";
import { IReadonlyTheme } from "@microsoft/sp-component-base";

export interface IFilterNumberRangeComponentProps {
  filter: IDataFilterInternal;
  themeVariant?: IReadonlyTheme;
  onUpdate: (filterValues: IDataFilterValueInfo[]) => void;
}

export interface IFilterNumberRangeComponentState {
  selectedFrom: string;
  selectedTo: string;
}

export class FilterNumberRangeComponent extends React.Component<
  IFilterNumberRangeComponentProps,
  IFilterNumberRangeComponentState & {
    lastAppliedFrom: string;
    lastAppliedTo: string;
  }
> {
  constructor(props: IFilterNumberRangeComponentProps) {
    super(props);
    this.state = {
      selectedFrom: "",
      selectedTo: "",
      lastAppliedFrom: "",
      lastAppliedTo: "",
    };
    this._updateFrom = this._updateFrom.bind(this);
    this._updateTo = this._updateTo.bind(this);
    this._applyFilter = this._applyFilter.bind(this);
    this._clearFilters = this._clearFilters.bind(this);
  }

  public render() {
    return (
      <div className="section-anim open">
        <div className="d-flex align-items-center mb-2 mt-2 mx-2 justify-content-center flex-row-reverse gap-2">
          <span
            style={{
              fontSize: "1.3em",
              minWidth: 24,
              textAlign: "center",
            }}
          >
            $
          </span>
          <input
            className="form-control flex-grow-1"
            placeholder="עד"
            type="number"
            value={this.state.selectedTo}
            onChange={(e) => this._updateTo(e, e.target.value)}
            style={{
              background: "rgb(250, 251, 252)",
              border: "1px solid rgb(224, 224, 224)",
              borderRadius: 8,
              textAlign: "center",
            }}
          />
          <span
            className="mx-1 text-muted"
            style={{
              fontSize: "1.3em",
              userSelect: "none",
            }}
          >
            -
          </span>
          <input
            className="form-control flex-grow-1"
            placeholder="מ-"
            type="number"
            value={this.state.selectedFrom}
            onChange={(e) => this._updateFrom(e, e.target.value)}
            style={{
              background: "rgb(250, 251, 252)",
              border: "1px solid rgb(224, 224, 224)",
              borderRadius: 8,
              textAlign: "center",
            }}
          />
        </div>
      </div>
    );
  }

  componentDidMount() {
    // Try to read range values from URL param (e.g. f=prjScopeInDollarsNum:range(100,1000000) or JSON format)
    const urlParams = new URLSearchParams(window.location.search);
    const filterName = this.props.filter?.filterName;
    if (filterName) {
      const fParams = urlParams.getAll("f");
      for (const param of fParams) {
        // 1. Try FQL string format
        const match = param.match(
          new RegExp(`${filterName}:range\\((\\d+),(\\d+)\\)`)
        );
        if (match) {
          this.setState({
            selectedFrom: match[1],
            selectedTo: match[2],
            lastAppliedFrom: match[1],
            lastAppliedTo: match[2],
          });
          break;
        }
        const matchFrom = param.match(
          new RegExp(`${filterName}:range\\((\\d+),max\\)`)
        );
        if (matchFrom) {
          this.setState({
            selectedFrom: matchFrom[1],
            selectedTo: "",
            lastAppliedFrom: matchFrom[1],
            lastAppliedTo: "",
          });
          break;
        }
        const matchTo = param.match(
          new RegExp(`${filterName}:range\\(min,(\\d+)\\)`)
        );
        if (matchTo) {
          this.setState({
            selectedFrom: "",
            selectedTo: matchTo[1],
            lastAppliedFrom: "",
            lastAppliedTo: matchTo[1],
          });
          break;
        }
        // 2. Try JSON-encoded array format
        try {
          const decoded = decodeURIComponent(param);
          if (decoded.startsWith("[")) {
            const arr = JSON.parse(decoded);
            const filterObj = arr.find((f) => f.filterName === filterName);
            if (filterObj && Array.isArray(filterObj.values)) {
              let from = "";
              let to = "";
              filterObj.values.forEach((v) => {
                if (
                  v.operator === FilterComparisonOperator.Geq ||
                  v.operator === 4
                )
                  from = v.value;
                if (
                  v.operator === FilterComparisonOperator.Leq ||
                  v.operator === 5
                )
                  to = v.value;
              });
              this.setState({
                selectedFrom: from,
                selectedTo: to,
                lastAppliedFrom: from,
                lastAppliedTo: to,
              });
              break;
            }
          }
        } catch {
          /* ignore */
        }
      }
    }
  }

  private _updateFrom(
    ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>,
    newValue?: string
  ) {
    // Allow empty or valid number
    if (
      newValue === undefined ||
      newValue === "" ||
      /^-?\d*(\.\d*)?$/.test(newValue)
    ) {
      this.setState({ selectedFrom: newValue || "" });
    }
  }

  private _updateTo(
    ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>,
    newValue?: string
  ) {
    if (
      newValue === undefined ||
      newValue === "" ||
      /^-?\d*(\.\d*)?$/.test(newValue)
    ) {
      this.setState({ selectedTo: newValue || "" });
    }
  }

  private _applyFilter() {
    const { selectedFrom, selectedTo } = this.state;
    let updatedValues: IDataFilterValueInfo[] = [];
    if (selectedFrom && selectedTo) {
      updatedValues.push({
        name: selectedFrom,
        value: String(Number(selectedFrom)),
        operator: FilterComparisonOperator.Geq,
        selected: true,
      });
      updatedValues.push({
        name: selectedTo,
        value: String(Number(selectedTo)),
        operator: FilterComparisonOperator.Leq,
        selected: true,
      });
    } else if (selectedFrom) {
      updatedValues.push({
        name: selectedFrom,
        value: String(Number(selectedFrom)),
        operator: FilterComparisonOperator.Geq,
        selected: true,
      });
    } else if (selectedTo) {
      updatedValues.push({
        name: selectedTo,
        value: String(Number(selectedTo)),
        operator: FilterComparisonOperator.Leq,
        selected: true,
      });
    }
    this.setState({ lastAppliedFrom: selectedFrom, lastAppliedTo: selectedTo });
    this.props.onUpdate(updatedValues);
  }

  private _clearFilters() {
    this.setState(
      {
        selectedFrom: "",
        selectedTo: "",
        lastAppliedFrom: "",
        lastAppliedTo: "",
      },
      () => this.props.onUpdate([])
    );
  }
}

export class FilterNumberRangeWebComponent extends BaseWebComponent {
  public constructor() {
    super();
  }
  public async connectedCallback() {
    let props = this.resolveAttributes();
    let renderNumberRange: JSX.Element = null;
    if (props.filter) {
      const filter = props.filter as IDataFilterInternal;
      renderNumberRange = (
        <FilterNumberRangeComponent
          {...props}
          filter={filter}
          onUpdate={((filterValues: IDataFilterValueInfo[]) => {
            // Unselect all previous values
            const updatedValues = filter.values.map((value) => {
              if (
                filterValues.filter(
                  (filterValue) => filterValue.value === value.value
                ).length === 0
              ) {
                return {
                  name: value.name,
                  selected: false,
                  value: value.value,
                  operator: value.operator,
                } as IDataFilterValueInfo;
              }
            });
            this.dispatchEvent(
              new CustomEvent(ExtensibilityConstants.EVENT_FILTER_UPDATED, {
                detail: {
                  filterName: filter.filterName,
                  filterValues: filterValues.concat(
                    updatedValues.filter((v) => v)
                  ),
                  instanceId: props.instanceId,
                } as IDataFilterInfo,
                bubbles: true,
                cancelable: true,
              })
            );
          }).bind(this)}
        />
      );
    } else {
      renderNumberRange = (
        <MessageBar messageBarType={MessageBarType.warning} isMultiline={false}>
          {`Component <pnp-number-range> misconfigured. The HTML attribute 'filter' is missing.`}
        </MessageBar>
      );
    }
    ReactDOM.render(renderNumberRange, this);
  }
  protected onDispose(): void {
    ReactDOM.unmountComponentAtNode(this);
  }
}
