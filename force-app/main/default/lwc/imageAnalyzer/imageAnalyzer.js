import { LightningElement, api, track, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import analyzeFiles from '@salesforce/apex/AIFileAnalysisController.analyzeFiles';
import getRelatedFiles from '@salesforce/apex/AIFileAnalysisController.getRelatedFiles';
import getOrgBaseUrl from '@salesforce/apex/AIFileAnalysisController.getOrgBaseUrl';
import createEnergyUseRecords from '@salesforce/apex/AIFileAnalysisController.createEnergyUseRecords';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class AIFileAnalysisController extends NavigationMixin(LightningElement) {
    @api recordId;
    @api flowApiName = 'Process_AI_Analysis_Result';

    @track uploadedFileId;
    @track uploadedFileName;
    @track aiResult = '';
    @track errorMessage = '';
    @track isLoading = false;
    @track disableAnalyzeButton = true;
    @track disableCreateRecordsButton = true;
    @track isCreatingRecords = false;

    @track showActionToast = false;
    @track actionToastMessage = '';

    @track fileOptions = [];
    @track orgBaseUrl;
    @track createdRecordIds = [];

    _wiredFilesResult;

    /**
     * NEW: A getter that attempts to parse the AI result as JSON.
     * If successful, it formats the data for display (handles both objects and arrays).
     * If not, it returns null, and the component will fall back to displaying raw text.
     */
    get formattedResult() {
        try {
            // Clean the string: The AI might wrap the JSON in ```json ... ```
            const cleanedString = this.aiResult.replace(/```json\n?|\n?```/g, '').trim();
            const parsed = JSON.parse(cleanedString);
            
            // Handle single object
            if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
                return {
                    type: 'single',
                    data: Object.keys(parsed).map(key => {
                        // Create a more readable label from the JSON key
                        const label = key.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
                        return {
                            id: key,
                            label: label,
                            value: parsed[key]
                        };
                    })
                };
            }
            
            // Handle array of objects
            if (Array.isArray(parsed) && parsed.length > 0) {
                // Prepare data for lightning-datatable
                const tableData = parsed.map((item, index) => {
                    if (typeof item === 'object' && item !== null) {
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

                // Generate columns dynamically based on the first object
                let columns = [
                    { label: '#', fieldName: 'rowIndex', type: 'number', fixedWidth: 50 }
                ];

                if (tableData.length > 0) {
                    const firstItem = tableData[0];
                    Object.keys(firstItem).forEach(key => {
                        if (key !== 'Id' && key !== 'rowIndex') {
                            const label = key.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
                            columns.push({
                                label: label,
                                fieldName: key,
                                type: 'text',
                                wrapText: true
                            });
                        }
                    });
                }

                return {
                    type: 'array',
                    data: tableData,
                    columns: columns
                };
            }
            
            return null; // It's valid JSON, but not a format we can display
        } catch (e) {
            // If parsing fails, it's not JSON. Return null.
            return null;
        }
    }

    /**
     * Helper getter to check if the result is a single object
     */
    get isSingleResult() {
        return this.formattedResult && this.formattedResult.type === 'single';
    }

    /**
     * Helper getter to check if the result is an array
     */
    get isArrayResult() {
        return this.formattedResult && this.formattedResult.type === 'array';
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
        return this.formattedResult && this.formattedResult.columns ? this.formattedResult.columns : [];
    }

    /**
     * Helper getter to get the count of items in array result  
     */
    get arrayItemCount() {
        return this.isArrayResult && this.resultData ? this.resultData.length : 0;
    }

    @wire(getOrgBaseUrl)
    wiredOrgUrl({ error, data }) {
        if (data) {
            this.orgBaseUrl = data;
        } else if (error) {
            console.error('Error fetching org base URL:', error);
            this.showToastMessage('Error', 'Could not determine org URL.', 'error');
        }
    }

    @wire(getRelatedFiles, { recordId: '$recordId' })
    wiredFiles(result) {
        this._wiredFilesResult = result; 
        if (result.data) {
            this.fileOptions = result.data;
            this.errorMessage = undefined;
        } else if (result.error) {
            this.errorMessage = 'Could not load existing files.';
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
        return this.createdRecordIds.length !== 1 ? 's' : '';
    }

    resetSelectionState() {
        this.aiResult = '';
        this.errorMessage = '';
        this.uploadedFileId = null;
        this.uploadedFileName = null;
        this.disableAnalyzeButton = true;
        this.disableCreateRecordsButton = true;
        this.createdRecordIds = [];
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
        const selectedOption = this.fileOptions.find(option => option.value === this.uploadedFileId);
        if (selectedOption) {
            this.uploadedFileName = selectedOption.label;
        }
        this.disableAnalyzeButton = false;
    }

    async handleAnalyzeFiles() {
        if (!this.uploadedFileId) {
            this.errorMessage = 'Please select a file to analyze first.';
            return;
        }
        this.isLoading = true;
        this.errorMessage = '';
        this.aiResult = '';
        try {
            const result = await analyzeFiles({ fileId: this.uploadedFileId });
            this.aiResult = result;
            this.disableCreateRecordsButton = false; // Enable create records button once analysis is complete
            this.showToastMessage('AI Analysis Complete', 'The AI-powered analysis is now ready!', 'success');
        } catch (err) {
            this.errorMessage = (err && err.body && err.body.message) || 'Error analyzing file. Please try again.';
            this.showToastMessage('Analysis Error', this.errorMessage, 'error');
            this.disableCreateRecordsButton = true;
        } finally {
            this.isLoading = false;
        }
    }

    handleCopyToClipboard() {
        // Copy the raw result, not the formatted version
        navigator.clipboard.writeText(this.aiResult);
        this.showSimpleActionToast('Copied to clipboard!');
    }

    async handleCreateRecords() {
        if (!this.aiResult) {
            this.showToastMessage('No Data', 'Please analyze a file first before creating records.', 'warning');
            return;
        }
        
        this.isCreatingRecords = true;
        this.errorMessage = '';
        
        try {
            const createdIds = await createEnergyUseRecords({ 
                jsonData: this.aiResult, 
                recordId: this.recordId 
            });
            
            this.createdRecordIds = createdIds;
            
            if (createdIds && createdIds.length > 0) {
                const recordCount = createdIds.length;
                const message = recordCount === 1 
                    ? `Successfully created 1 Energy Use record!` 
                    : `Successfully created ${recordCount} Energy Use records!`;
                this.showToastMessage('Success', message, 'success');
                this.showSimpleActionToast(`${recordCount} record${recordCount !== 1 ? 's' : ''} created successfully!`);
            } else {
                this.showToastMessage('No Records Created', 'No valid data found to create Energy Use records.', 'warning');
            }
        } catch (err) {
            const errorMessage = (err && err.body && err.body.message) || 'Error creating Energy Use records. Please try again.';
            this.errorMessage = errorMessage;
            this.showToastMessage('Creation Error', errorMessage, 'error');
        } finally {
            this.isCreatingRecords = false;
        }
    }

    handleStartFlow() {
        if (!this.flowApiName) {
            this.showToastMessage('Configuration Error', 'Flow API Name is not available.', 'error');
            return;
        }
        // Pass the raw result to the flow
        const encodedResult = encodeURIComponent(this.aiResult);
        let flowUrl = `/flow/${this.flowApiName}?input_AIAnalysisResult=${encodedResult}&recordId=${this.recordId}`;
        window.open(flowUrl, '_blank');
    }

    showSimpleActionToast(msg) {
        this.actionToastMessage = msg;
        this.showActionToast = true;
        setTimeout(() => { this.showActionToast = false; }, 1500);
    }

    showToastMessage(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title: title, message: message, variant: variant || 'info' }));
    }
}
// This component handles file uploads, AI analysis, and displays results.
