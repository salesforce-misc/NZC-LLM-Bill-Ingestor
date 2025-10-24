import { LightningElement, api } from 'lwc';

export default class EnergyRecordDetail extends LightningElement {
    @api recordData;
    @api showComponent = false;
    
    /**
     * Helper getter to prepare detail fields for display
     */
    get detailFields() {
        if (!this.recordData) return [];
        
        const fields = [];
        Object.keys(this.recordData).forEach(key => {
            if (key !== 'Id' && key !== 'rowIndex') {
                const label = key.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
                fields.push({
                    key: key,
                    label: label,
                    value: this.recordData[key] || 'N/A'
                });
            }
        });
        
        return fields;
    }
    
    /**
     * Get record title for display
     */
    get recordTitle() {
        if (!this.recordData) return 'Record Details';
        
        // Try to find a meaningful title from common fields
        const titleFields = ['account_number', 'account', 'name', 'title'];
        for (let field of titleFields) {
            if (this.recordData[field]) {
                return `Details for ${this.recordData[field]}`;
            }
        }
        
        return `Record #${this.recordData.rowIndex || 'Unknown'}`;
    }
    
    /**
     * Close the detail view
     */
    handleClose() {
        // Dispatch custom event to parent component
        const closeEvent = new CustomEvent('closedetail', {
            detail: {
                message: 'Detail view closed'
            }
        });
        this.dispatchEvent(closeEvent);
    }
}