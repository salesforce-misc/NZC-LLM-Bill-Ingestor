import { LightningElement, api, track, wire } from "lwc";
import { NavigationMixin } from "lightning/navigation";
import analyzeFiles from "@salesforce/apex/AIFileAnalysisController.analyzeFiles";
import getRelatedFiles from "@salesforce/apex/AIFileAnalysisController.getRelatedFiles";
import createEnergyUseRecords from "@salesforce/apex/AIFileAnalysisController.createEnergyUseRecords";
import { ShowToastEvent } from "lightning/platformShowToastEvent";

export default class AIFileAnalysisController extends NavigationMixin(
  LightningElement
) {
  @api recordId;
  @api flowApiName = "Process_AI_Analysis_Result";

  @track uploadedFileId;
  @track uploadedFileName;
  @track aiResult = "";
  @track errorMessage = "";
  @track isLoading = false;
  @track disableAnalyzeButton = true;
  @track disableCreateRecordsButton = true;
  @track isCreatingRecords = false;

  @track showActionToast = false;
  @track actionToastMessage = "";

  @track fileOptions = [];
  @track createdRecordIds = [];
  @track selectedRowData = null;
  @track showDetailView = false;
  @track _formattedResult = null;
  @track sortedBy;
  @track sortedDirection = "asc";
  @track draftValues = [];
  _lastAiResult = "";
  _resetTimeoutId;

  _wiredFilesResult;

  /**
   * NEW: A getter that attempts to parse the AI result as JSON.
   * If successful, it formats the data for display (handles both objects and arrays).
   * If not, it returns null, and the component will fall back to displaying raw text.
   */
  get formattedResult() {
    // Cache the result to avoid excessive processing
    if (
      this._formattedResult !== null &&
      this._lastAiResult === this.aiResult
    ) {
      return this._formattedResult;
    }

    if (!this.aiResult) {
      this._formattedResult = null;
      return null;
    }

    try {
      // Clean the string: The AI might wrap the JSON in ```json ... ```
      const cleanedString = this.aiResult
        .replace(/```json\n?|\n?```/g, "")
        .trim();

      const parsed = JSON.parse(cleanedString);

      // Handle single object
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        !Array.isArray(parsed)
      ) {
        this._formattedResult = {
          type: "single",
          rawObject: { ...parsed },
          data: Object.keys(parsed).map((key) =>
            this._toSingleField(key, parsed[key])
          )
        };
        this._lastAiResult = this.aiResult;
        return this._formattedResult;
      }

      // Handle array of objects
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Prepare data for lightning-datatable
        const tableData = parsed.map((item, index) => {
          if (typeof item === "object" && item !== null) {
            // Add an ID and index to each row
            return {
              Id: `item-${index}`,
              rowIndex: index + 1,
              ...item
            };
          }
          // Handle primitive values in array
          return {
            Id: `item-${index}`,
            rowIndex: index + 1,
            value: item
          };
        });

        // Generate essential columns only - Account Number, Due Date, Kilowatts Consumed
        const columns = [
          {
            label: "#",
            fieldName: "rowIndex",
            type: "number",
            fixedWidth: 60,
            sortable: true,
            initialWidth: 60
          }
        ];

        // Define essential fields we want to display
        const essentialFields = [
          {
            key: "account_number",
            label: "Account Number",
            type: "text",
            wrapText: true,
            sortable: true,
            editable: true
          },
          {
            key: "due_date",
            label: "Due Date",
            type: "date",
            sortable: true,
            editable: true,
            typeAttributes: {
              year: "numeric",
              month: "short",
              day: "2-digit"
            }
          },
          {
            key: "kilowatts_consumed",
            label: "kWh Consumed",
            type: "number",
            sortable: true,
            editable: true,
            typeAttributes: {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            }
          },
          {
            key: "therms_consumed",
            label: "Therms Consumed",
            type: "number",
            sortable: true,
            editable: true,
            typeAttributes: {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            }
          }
        ];

        if (tableData.length > 0) {
          const firstItem = tableData[0];
          // Only add columns for essential fields that exist in the data
          essentialFields.forEach((field) => {
            if (field.key in firstItem && firstItem[field.key] !== undefined) {
              const column = {
                label: field.label,
                fieldName: field.key,
                type: field.type,
                sortable: field.sortable !== false // Default to sortable unless explicitly false
              };

              // Add wrapText if specified
              if (field.wrapText) {
                column.wrapText = true;
              }

              // Add typeAttributes if specified
              if (field.typeAttributes) {
                column.typeAttributes = field.typeAttributes;
              }

              if (field.editable) {
                column.editable = true;
              }

              columns.push(column);
            }
          });

          // Add custom button column for viewing details
          columns.push({
            type: "action",
            typeAttributes: {
              rowActions: [
                {
                  label: "View Details",
                  name: "view_details",
                  iconName: "utility:preview"
                }
              ],
              menuAlignment: "right"
            },
            fixedWidth: 110,
            cellAttributes: {
              class: "ai-action-cell"
            }
          });
        }

        this._formattedResult = {
          type: "array",
          data: tableData,
          columns: columns
        };

        // Initialize sorting by rowIndex on first load
        if (!this.sortedBy) {
          this.sortedBy = "rowIndex";
          this.sortedDirection = "asc";
        }

        this._lastAiResult = this.aiResult;
        return this._formattedResult;
      }

      this._formattedResult = null;
      this._lastAiResult = this.aiResult;
      return null; // It's valid JSON, but not a format we can display
    } catch {
      // If parsing fails, it's not JSON. Return null.
      this._formattedResult = null;
      this._lastAiResult = this.aiResult;
      return null;
    }
  }

  /**
   * Helper getter to check if the result is a single object
   */
  /** Keys that receive comma separators (amount_due, kilowatts_consumed, charge_amount_electricity) */
  static _COMMA_FORMAT_KEYS = new Set([
    "amount_due",
    "kilowatts_consumed",
    "charge_amount_electricity"
  ]);

  static _NUMBER_INPUT_KEYS = new Set([
    "amount_due",
    "kilowatts_consumed",
    "charge_amount_electricity",
    "therms_consumed",
    "charge_amount_gas"
  ]);

  static _DATE_INPUT_KEYS = new Set(["due_date", "statement_date"]);

  static _PAYLOAD_META_KEYS = new Set(["Id", "rowIndex"]);

  /**
   * Format display value for analysis result table. Null/empty renders "-".
   * Only amount_due, kilowatts_consumed, charge_amount_electricity get comma separators.
   */
  _formatDisplayValue(value, key) {
    if (value === null || value === undefined || value === "") {
      return "-";
    }
    const str = String(value).trim();
    if (str === "") return "-";
    if (
      this.constructor._COMMA_FORMAT_KEYS.has(String(key).toLowerCase()) &&
      !str.includes("/") &&
      !/[a-zA-Z]/.test(str)
    ) {
      const numValue = parseFloat(value);
      if (!isNaN(numValue) && Number.isFinite(numValue)) {
        return numValue.toLocaleString("en-US");
      }
    }
    return str;
  }

  get isSingleResult() {
    return this.formattedResult && this.formattedResult.type === "single";
  }

  /**
   * Helper getter to check if the result is an array
   */
  get isArrayResult() {
    return this.formattedResult && this.formattedResult.type === "array";
  }

  /**
   * Helper getter to get the actual data for display
   */
  get resultData() {
    return this.formattedResult ? this.formattedResult.data : null;
  }

  /**
   * Helper getter to get columns for lightning-datatable
   */
  get tableColumns() {
    return this.formattedResult && this.formattedResult.columns
      ? this.formattedResult.columns
      : [];
  }

  /**
   * Helper getter to get the count of items in array result
   */
  get arrayItemCount() {
    return this.isArrayResult && this.resultData ? this.resultData.length : 0;
  }

  @wire(getRelatedFiles, { recordId: "$recordId" })
  wiredFiles(result) {
    this._wiredFilesResult = result;
    if (result.data) {
      this.fileOptions = result.data;
      this.errorMessage = undefined;
    } else if (result.error) {
      this.errorMessage = "Could not load existing files.";
      this.fileOptions = [];
    }
  }

  get hasFiles() {
    return this.fileOptions && this.fileOptions.length > 0;
  }

  get uploadRecordId() {
    return this.recordId;
  }

  get pluralSuffix() {
    return this.createdRecordIds.length !== 1 ? "s" : "";
  }

  disconnectedCallback() {
    this._clearResetTimeout();
  }

  _clearResetTimeout() {
    if (this._resetTimeoutId) {
      clearTimeout(this._resetTimeoutId);
      this._resetTimeoutId = undefined;
    }
  }

  _scheduleOriginalStateReset() {
    this._clearResetTimeout();
    this._resetTimeoutId = setTimeout(() => {
      this._resetTimeoutId = undefined;
      this.resetSelectionState();
    }, 15000);
  }

  resetSelectionState() {
    this._clearResetTimeout();
    this.aiResult = "";
    this.errorMessage = "";
    this.uploadedFileId = null;
    this.uploadedFileName = null;
    this.disableAnalyzeButton = true;
    this.disableCreateRecordsButton = true;
    this.createdRecordIds = [];
    this.selectedRowData = null;
    this.showDetailView = false;
    this._formattedResult = null;
    this._lastAiResult = "";
    this.sortedBy = undefined;
    this.sortedDirection = "asc";
    this.draftValues = [];
    this.showActionToast = false;
    this.actionToastMessage = "";
  }

  fileUploadHandler(event) {
    this.resetSelectionState();
    const uploadedFiles = event.detail.files;
    if (uploadedFiles && uploadedFiles.length > 0) {
      this.uploadedFileId = uploadedFiles[0].documentId;
      this.uploadedFileName = uploadedFiles[0].name;
      this.disableAnalyzeButton = false;
    }
  }

  handleFileSelectionChange(event) {
    this.resetSelectionState();
    this.uploadedFileId = event.detail.value;
    const selectedOption = this.fileOptions.find(
      (option) => option.value === this.uploadedFileId
    );
    if (selectedOption) {
      this.uploadedFileName = selectedOption.label;
    }
    this.disableAnalyzeButton = false;
  }

  async handleAnalyzeFiles() {
    if (!this.uploadedFileId) {
      this.errorMessage = "Please select a file to analyze first.";
      return;
    }
    this.isLoading = true;
    this.errorMessage = "";
    this.aiResult = "";
    try {
      const result = await analyzeFiles({ fileId: this.uploadedFileId });
      this.aiResult = result;
      this.disableCreateRecordsButton = false; // Enable create records button once analysis is complete
      this.showToastMessage(
        "AI Analysis Complete",
        "The AI-powered analysis is now ready!",
        "success"
      );
    } catch (err) {
      this.errorMessage =
        (err && err.body && err.body.message) ||
        "Error analyzing file. Please try again.";
      this.showToastMessage("Analysis Error", this.errorMessage, "error");
      this.disableCreateRecordsButton = true;
    } finally {
      this.isLoading = false;
    }
  }

  handleCopyToClipboard() {
    // Copy the raw result, not the formatted version
    navigator.clipboard.writeText(this.aiResult);
    this.showSimpleActionToast("Copied to clipboard!");
  }

  async handleCreateRecords() {
    if (!this.aiResult) {
      this.showToastMessage(
        "No Data",
        "Please analyze a file first before creating records.",
        "warning"
      );
      return;
    }

    this.isCreatingRecords = true;
    this.errorMessage = "";

    try {
      if (this.isArrayResult && this.draftValues.length) {
        this._applyDrafts(this.draftValues);
      }

      const createdRecords = this._normalizeCreatedRecords(
        await createEnergyUseRecords({
          jsonData: this._buildJsonForCreate(),
          recordId: this.recordId
        })
      );

      this.createdRecordIds = createdRecords.map((record) => record.id);

      if (createdRecords.length > 0) {
        this._showCreateSuccessToast(createdRecords);
        this._scheduleOriginalStateReset();
      } else {
        this.showToastMessage(
          "No Records Created",
          "No valid data found to create Energy Use records.",
          "warning"
        );
      }
    } catch (err) {
      const errorMessage =
        (err && err.body && err.body.message) ||
        "Error creating Energy Use records. Please try again.";
      this.errorMessage = errorMessage;
      this.showToastMessage("Creation Error", errorMessage, "error");
    } finally {
      this.isCreatingRecords = false;
    }
  }

  handleSave(event) {
    this._applyDrafts(event.detail.draftValues);
  }

  handleCellChange(event) {
    this.draftValues = event.detail.draftValues || [];
  }

  handleSingleFieldChange(event) {
    const key = event.target.dataset.fieldKey;
    if (
      !key ||
      !this._formattedResult ||
      this._formattedResult.type !== "single"
    ) {
      return;
    }

    const field = this._formattedResult.data.find((item) => item.id === key);
    const inputType = field ? field.inputType : "text";
    const inputValue = event.target.value;
    const storedValue = this._fromInputValue(inputValue, inputType);

    this._formattedResult = {
      ...this._formattedResult,
      rawObject: {
        ...this._formattedResult.rawObject,
        [key]: storedValue
      },
      data: this._formattedResult.data.map((item) =>
        item.id === key
          ? {
              ...item,
              editValue: inputValue,
              value: this._formatDisplayValue(storedValue, key)
            }
          : item
      )
    };
  }

  _toSingleField(key, rawValue) {
    const label = key
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
    const inputType = this._inputTypeForKey(key);
    return {
      id: key,
      label: label,
      value: this._formatDisplayValue(rawValue, key),
      editValue: this._toInputValue(rawValue, inputType),
      inputType: inputType,
      step: inputType === "number" ? "0.01" : undefined
    };
  }

  _inputTypeForKey(key) {
    const normalized = String(key).toLowerCase();
    if (this.constructor._NUMBER_INPUT_KEYS.has(normalized)) {
      return "number";
    }
    if (this.constructor._DATE_INPUT_KEYS.has(normalized)) {
      return "date";
    }
    return "text";
  }

  _toInputValue(rawValue, inputType) {
    if (rawValue === null || rawValue === undefined || rawValue === "") {
      return "";
    }
    if (inputType === "date") {
      return this._toIsoDateString(rawValue);
    }
    return String(rawValue);
  }

  _fromInputValue(inputValue, inputType) {
    if (inputValue === null || inputValue === undefined || inputValue === "") {
      return "";
    }
    if (inputType === "date") {
      return this._toApexDateString(inputValue);
    }
    if (inputType === "number") {
      const parsed = Number(inputValue);
      return Number.isFinite(parsed) ? parsed : inputValue;
    }
    return inputValue;
  }

  _toIsoDateString(value) {
    const str = String(value).trim();
    const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
      return `${iso[1]}-${iso[2]}-${iso[3]}`;
    }
    const us = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (!us) {
      return str;
    }
    const month = us[1].padStart(2, "0");
    const day = us[2].padStart(2, "0");
    let year = us[3];
    if (year.length === 2) {
      year = Number(year) <= 30 ? `20${year}` : `19${year}`;
    }
    return `${year}-${month}-${day}`;
  }

  _toApexDateString(value) {
    if (value === null || value === undefined || value === "") {
      return value;
    }
    const str = String(value).trim();
    const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
      return `${iso[2]}/${iso[3]}/${iso[1]}`;
    }
    return str;
  }

  _normalizeDraft(draft) {
    const normalized = { ...draft };
    if (Object.prototype.hasOwnProperty.call(normalized, "due_date")) {
      normalized.due_date = this._toApexDateString(normalized.due_date);
    }
    return normalized;
  }

  _mergeDraftsIntoRows(rows, drafts) {
    if (!rows || !drafts || drafts.length === 0) {
      return rows;
    }
    const idToDraft = new Map(
      drafts.map((draft) => [draft.Id, this._normalizeDraft(draft)])
    );
    return rows.map((row) => {
      const draft = idToDraft.get(row.Id);
      if (!draft) {
        return row;
      }
      const changes = { ...draft };
      delete changes.Id;
      return { ...row, ...changes };
    });
  }

  _applyDrafts(drafts) {
    if (!this._formattedResult || this._formattedResult.type !== "array") {
      this.draftValues = [];
      return;
    }
    const merged = this._mergeDraftsIntoRows(
      this._formattedResult.data,
      drafts
    );
    this._formattedResult = {
      ...this._formattedResult,
      data: merged
    };
    this.draftValues = [];
    if (this.selectedRowData) {
      const updated = merged.find((row) => row.Id === this.selectedRowData.Id);
      if (updated) {
        this.selectedRowData = updated;
      }
    }
  }

  _rowsToPayload(rows) {
    return rows.map((row) => {
      const payload = {};
      Object.keys(row).forEach((key) => {
        if (!this.constructor._PAYLOAD_META_KEYS.has(key)) {
          payload[key] =
            key === "due_date" || key === "statement_date"
              ? this._toApexDateString(row[key])
              : row[key];
        }
      });
      return payload;
    });
  }

  _buildJsonForCreate() {
    const formatted = this.formattedResult;
    if (!formatted) {
      return this.aiResult;
    }
    if (formatted.type === "array") {
      const merged = this._mergeDraftsIntoRows(
        formatted.data,
        this.draftValues
      );
      return JSON.stringify(this._rowsToPayload(merged));
    }
    if (formatted.type === "single" && formatted.rawObject) {
      const payload = { ...formatted.rawObject };
      if (Object.prototype.hasOwnProperty.call(payload, "due_date")) {
        payload.due_date = this._toApexDateString(payload.due_date);
      }
      if (Object.prototype.hasOwnProperty.call(payload, "statement_date")) {
        payload.statement_date = this._toApexDateString(payload.statement_date);
      }
      return JSON.stringify(payload);
    }
    return this.aiResult;
  }

  handleSort(event) {
    const { fieldName: sortedBy, sortDirection } = event.detail;
    const cloneData = [...this.resultData];

    // Sort the data based on the field and direction
    cloneData.sort((a, b) => {
      let aVal = a[sortedBy];
      let bVal = b[sortedBy];

      // Handle null/undefined values
      if (aVal === null || aVal === undefined) aVal = "";
      if (bVal === null || bVal === undefined) bVal = "";

      // Convert to string for comparison if needed
      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();

      // Compare values
      let result = 0;
      if (aVal > bVal) result = 1;
      if (aVal < bVal) result = -1;

      // Return based on sort direction
      return sortDirection === "asc" ? result : -result;
    });

    // Update the sorted data and sorting state
    this._formattedResult.data = cloneData;
    this.sortedBy = sortedBy;
    this.sortedDirection = sortDirection;
  }

  handleRowAction(event) {
    const actionName = event.detail.action.name;
    const row = event.detail.row;

    if (actionName === "view_details") {
      this.handleShowDetails(row);
    }
  }

  handleShowDetails(row) {
    // Check if this is the same record to avoid unnecessary re-renders
    const isSameRecord =
      this.selectedRowData && this.selectedRowData.Id === row.Id;

    if (isSameRecord) {
      return;
    }

    // Update to new record data (works for both new and switching records)
    this.selectedRowData = row;
    this.showDetailView = true;
  }

  handleCloseDetails() {
    this.showDetailView = false;
    this.selectedRowData = null;
  }

  showSimpleActionToast(msg) {
    this.actionToastMessage = msg;
    this.showActionToast = true;
    setTimeout(() => {
      this.showActionToast = false;
    }, 1500);
  }

  _normalizeCreatedRecords(created) {
    if (!created || created.length === 0) {
      return [];
    }
    return created.map((record) => {
      if (typeof record === "string") {
        return { id: record, fuelType: "Energy Use" };
      }
      return {
        id: record.id,
        fuelType: record.fuelType || "Energy Use"
      };
    });
  }

  _fuelTypeLabel(fuelType) {
    if (fuelType === "NaturalGas") {
      return "Natural Gas";
    }
    if (fuelType === "Electricity") {
      return "Electricity";
    }
    return fuelType || "Energy Use";
  }

  _showCreateSuccessToast(createdRecords) {
    const recordCount = createdRecords.length;
    const placeholders = createdRecords
      .map((_, index) => `{${index}}`)
      .join(" ");
    const message =
      recordCount === 1
        ? `Successfully created 1 Energy Use record! ${placeholders}`
        : `Successfully created ${recordCount} Energy Use records! ${placeholders}`;

    const messageData = createdRecords.map((record) => ({
      url: `/${record.id}`,
      label:
        recordCount === 1
          ? "View record"
          : `View ${this._fuelTypeLabel(record.fuelType)} record`
    }));

    this.showToastMessage("Success", message, "success", {
      messageData,
      mode: "dismissable",
      duration: 15000
    });
    this.showSimpleActionToast(
      `${recordCount} record${recordCount !== 1 ? "s" : ""} created successfully!`
    );
  }

  showToastMessage(title, message, variant, options = {}) {
    this.dispatchEvent(
      new ShowToastEvent({
        title: title,
        message: message,
        variant: variant || "info",
        messageData: options.messageData,
        mode: options.mode,
        duration: options.duration
      })
    );
  }
}
// This component handles file uploads, AI analysis, and displays results.
