import * as React from 'react';
import { BaseWebComponent, IDataFilterInfo, IDataFilterValueInfo, ExtensibilityConstants } from '@pnp/modern-search-extensibility';
import * as ReactDOM from 'react-dom';
import { ChoiceGroup, IChoiceGroupOption, Checkbox } from '@fluentui/react';
import { IReadonlyTheme } from '@microsoft/sp-component-base';

export interface IFilterCheckBoxProps {

    /**
     * If the checkbox should be selected
     */
    selected?: boolean;

    /**
     * If the checkbox should be disabled
     */
    disabled?: boolean;

    /**
     * The count for this filter value
     */
    count?: number;

    /**
     * The filter value to display
     */
    name?: string;

    /**
     * The value to use when selected
     */
    value?: string;

    /**
     * The filter name where belong the value
     */
    filterName?: string;

    /**
     * The Web Part instance ID from where the filter component belongs
     */
    instanceId?: string;

    /**
     * Indicate if the filter is configured as multi values
     */
    isMulti?: boolean;

    /**
     * The current theme settings
     */
    themeVariant?: IReadonlyTheme;

    /**
     * Handler when a filter value is selected
     */
    onChecked: (filterName: string, filterValue: IDataFilterValueInfo) => void;
}

export interface IFilterCheckBoxState {
}

export class FilterCheckBoxComponent extends React.Component<IFilterCheckBoxProps, IFilterCheckBoxState> {

    public render() {

        let filterValue: IDataFilterValueInfo = {
            name: this.props.name,
            value: this.props.value,
            selected: this.props.selected
        };

        let renderInput: JSX.Element = null;
        let textColor: string = this.props.themeVariant && this.props.themeVariant.isInverted ? (this.props.themeVariant ? this.props.themeVariant.semanticColors.bodyText : '#323130') : this.props.themeVariant.semanticColors.inputText;
        

        if (this.props.isMulti) {
            renderInput = (
                <Checkbox
                    label={filterValue.name}
                    checked={!!this.props.selected}
                    disabled={this.props.disabled}
                    onChange={(ev, checked) => {
                        filterValue.selected = checked;
                        this.props.onChecked(this.props.filterName, filterValue);
                    }}
                    styles={{
                        root: {
                            margin: 0,
                            padding: 0,
                        },
                        label: {
                            width: '100%',
                            padding: 0,
                        },
                        checkbox: {
                            borderRadius: 4,
                            borderColor: '#038387',
                            width: 18,
                            height: 18,
                            background: this.props.selected ? '#038387' : '#fff',
                        },
                        checkmark: {
                            color: '#fff',
                        }
                    }}
                />
            );
        } else {
            renderInput = <ChoiceGroup
                defaultSelectedKey={this.props.selected ? filterValue.value : undefined}
                styles={{
                    root: {
                        position: 'relative',
                        display: 'flex',
                        paddingRight: 10,
                        paddingLeft: 10,
                        paddingBottom: 7,
                        paddingTop: 7,
                        selectors: {
                            '.ms-ChoiceField': {
                                marginTop: 0
                            }
                        }
                    }
                }}
                key={this.props.filterName}
                options={[
                    {
                        key: filterValue.value,
                        text: filterValue.name,
                        disabled: this.props.disabled,
                        styles: {
                            field: {
                                color: this.props.count && this.props.count === 0 ? this.props.themeVariant.semanticColors.disabledText : textColor
                            }
                        }
                    }
                ]}
                onChange={(ev?: React.FormEvent<HTMLInputElement>, option?: IChoiceGroupOption) => {
                    filterValue.selected = ev.currentTarget.checked;
                    this.props.onChecked(this.props.filterName, filterValue);
                }}
            />;
        }

        return renderInput;
    }
}

export class FilterCheckBoxWebComponent extends BaseWebComponent {

    public constructor() {
        super();
    }

    public async connectedCallback() {

        let props = this.resolveAttributes();
        const checkBox = <FilterCheckBoxComponent {...props} onChecked={((filterName: string, filterValue: IDataFilterValueInfo) => {
            // Bubble event through the DOM
            this.dispatchEvent(new CustomEvent(ExtensibilityConstants.EVENT_FILTER_UPDATED, {
                detail: {
                    filterName: filterName,
                    filterValues: [filterValue],
                    instanceId: props.instanceId
                } as IDataFilterInfo,
                bubbles: true,
                cancelable: true
            }));
        }).bind(this)}
        />;

        ReactDOM.render(checkBox, this);
    }

    protected onDispose(): void {
        ReactDOM.unmountComponentAtNode(this);
    }
}