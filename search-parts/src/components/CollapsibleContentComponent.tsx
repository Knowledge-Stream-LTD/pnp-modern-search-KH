"use client";
import * as React from 'react';
import { BaseWebComponent } from '@pnp/modern-search-extensibility';
import * as ReactDOM from 'react-dom';
import { IGroup, IGroupDividerProps, Icon, Text, GroupedList, ITextProps, IStyleFunctionOrObject, ITextStyles } from '@fluentui/react';
import { IReadonlyTheme } from '@microsoft/sp-component-base';
import styles from './CollapsibleContentComponent.module.scss';
import 'core-js/features/dom-collections';
// import * as DOMPurify from 'dompurify';
import * as DOMPurify from "isomorphic-dompurify";
import { Constants } from '../common/Constants';

export interface ICollapsibleContentComponentProps {

    /**
     * The collapsible groupe name
     */
    groupName?: string;

    /**
     * If the group should be collapsed by default
     */
    defaultCollapsed?: boolean;

    /**
     * Content of the header template
     */
    headerTemplate?: string;

    /**
     * Content of the items template
     */
    contentTemplate: string;

    /**
     * Content of the footer template
     */
    footerTemplate?: string;

    /**
     * The current theme settings
     */
    themeVariant?: IReadonlyTheme;

    /**
     * Optional React node to render inline with the header (e.g., filter actions)
     */
    headerActions?: React.ReactNode;
}

export interface ICollapsibleContentComponentState {

    /**
     * Current collapse/expand state for the group
     */
    isCollapsed: boolean;
}

export class CollapsibleContentComponent extends React.Component<ICollapsibleContentComponentProps, ICollapsibleContentComponentState> {

    private componentRef = React.createRef<HTMLDivElement>();
    private _domPurify: any;

    public constructor(props) {
        super(props);

        this.state = {
            isCollapsed: props.defaultCollapsed ? true : false,
        };

        this._onRenderCell = this._onRenderCell.bind(this);
        this._onRenderHeader = this._onRenderHeader.bind(this);
        this._onTogglePanel = this._onTogglePanel.bind(this);

        this._domPurify = DOMPurify;
        this._domPurify.setConfig({
            WHOLE_DOCUMENT: true,
            ALLOWED_URI_REGEXP: Constants.ALLOWED_URI_REGEXP,
        });
    }


    public render() {

        const groups: IGroup[] = [
            {
                key: this.props.groupName,
                name: this.props.groupName,
                count: 1, // The count should be at least 1 to show the header
                startIndex: 0,
                isShowingAll: true,
                hasMoreData: false,
                isCollapsed: this.state.isCollapsed,
            }
        ];

        const groupedList = <GroupedList
            items={[
                <div key={'template'} dangerouslySetInnerHTML={{ __html: this._domPurify.sanitize(this.props.contentTemplate) }}></div>
            ]}
            styles={{
                root: {
                    selectors: {
                        '.ms-List-cell': {
                            minHeight: 0
                        }
                    }
                }
            }}
            onRenderCell={this._onRenderCell}
            className={styles.collapsible__filterPanel__body__group}
            onShouldVirtualize={() => false}
            listProps={{ onShouldVirtualize: () => false }}
            groupProps={
                {
                    onRenderHeader: this._onRenderHeader,
                    onRenderFooter: ((props) => {

                        if (!props.group.isCollapsed) {
                            return <div dangerouslySetInnerHTML={{ __html: this._domPurify.sanitize(this.props.footerTemplate) }}></div>;
                        } else {
                            return null;
                        }
                    }).bind(this),
                }
            }
            groups={groups}
        />;

        return <div ref={this.componentRef} data-name={this.props.groupName} data-is-scrollable={true}>{groupedList}</div>;
    }

    private _onTogglePanel(props: IGroupDividerProps) {
        this.setState({
            isCollapsed: !props.group.isCollapsed
        });
        props.onToggleCollapse(props.group);
    }

    /**
     * PATCHED FOR PROJECT CATALOG FILTERS (2025-07-01)
     * Always render the headerTemplate (from Handlebars) inline with the group title and chevron,
     * so that Apply/Clear buttons are always visible and inline, regardless of collapsed state.
     * This is required because the web component/Handlebars bridge cannot inject content into the Fluent UI header row by default.
     *
     * If you revert to a React-only approach, remove this patch and use headerActions instead.
     */
    private _onRenderHeader(props: IGroupDividerProps): JSX.Element {
        let textColor: string = this.props.themeVariant && this.props.themeVariant.isInverted ? (this.props.themeVariant ? this.props.themeVariant.semanticColors.bodyText : '#323130') : this.props.themeVariant.semanticColors.inputText;
        const textComponentStyles: IStyleFunctionOrObject<ITextProps, ITextStyles> = {
            root: {
                color: textColor
            }
        };
        return (
            <div>
                <div
                    className={styles["collapsible__filterPanel__body__group__headerRow"]}
                    tabIndex={0}
                    onClick={() => {
                        this._onTogglePanel(props);
                    }}
                    onKeyPress={(e) => {
                        if (e.charCode === 13) {
                            this._onTogglePanel(props);
                        }
                    }}
                >
                    <div className={styles["collapsible__filterPanel__body__group__headerContent"]}>
                        <div className={styles.collapsible__filterPanel__body__headerIcon}>
                            {props.group.isCollapsed ? (
                                <Icon iconName='Add' style={{ color: '#092F63' }} />
                            ) : (
                                <Icon iconName='Remove' style={{ color: '#092F63' }} />
                            )}
                        </div>
                        <Text variant={'large'} styles={textComponentStyles} className={styles.collapsible__filterPanel__body__headerTitle}>{props.group.name}</Text>
                        {this.props.headerTemplate && (
                            <span className={styles.collapsibleHeaderActions}
                                  dangerouslySetInnerHTML={{ __html: this._domPurify.sanitize(this.props.headerTemplate) }}></span>
                        )}
                    </div>
                </div>
                {/* PATCH: Remove legacy below-header rendering of headerTemplate */}
            </div>
        );
    }

    private _onRenderCell(nestingDepth: number, item: any, itemIndex: number) {
        return (
            <div data-selection-index={itemIndex}>
                {item}
            </div>
        );
    }
}

export class CollapsibleContentWebComponent extends BaseWebComponent {

    public constructor() {
        super();
    }

    public async connectedCallback() {

        const domParser = new DOMParser();
        const htmlContent: Document = domParser.parseFromString(this.innerHTML, 'text/html');

        // Get the templates
        const headerTemplateContent = htmlContent.getElementById('collapsible-header');
        const contentTemplateContent = htmlContent.getElementById('collapsible-content');
        const footerTemplateContent = htmlContent.getElementById('collapsible-footer');

        let contentTemplate = null;
        let footerTemplate = null;
        let headerTemplate = null;

        if (contentTemplateContent) {
            contentTemplate = contentTemplateContent.innerHTML;
        }

        if (footerTemplateContent) {
            footerTemplate = footerTemplateContent.innerHTML;
        }

        if (headerTemplateContent) {
            headerTemplate = headerTemplateContent.innerHTML;
        }

        let props = this.resolveAttributes();
        const collapsibleContent = <CollapsibleContentComponent
            {...props}
            headerTemplate={headerTemplate}
            contentTemplate={contentTemplate}
            footerTemplate={footerTemplate}
        />;

        ReactDOM.render(collapsibleContent, this);
    }

    protected onDispose(): void {
        ReactDOM.unmountComponentAtNode(this);
    }
}