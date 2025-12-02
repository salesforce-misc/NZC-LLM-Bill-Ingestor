import { LightningElement, api } from 'lwc';

export default class EnergyRecordDetail extends LightningElement {
    @api recordData;
    @api showComponent = false;
    
    connectedCallback() {
        console.log('🎯 EnergyRecordDetail: Component connected');
        console.log('🎯 EnergyRecordDetail: recordData =', this.recordData);
        console.log('🎯 EnergyRecordDetail: showComponent =', this.showComponent);
    }
    
    renderedCallback() {
        console.log('🎯 EnergyRecordDetail: Component rendered');
        console.log('🎯 EnergyRecordDetail: recordData =', this.recordData);
        console.log('🎯 EnergyRecordDetail: showComponent =', this.showComponent);
    }
    
    /**
     * Helper getter to prepare detail fields for display
     */
    get detailFields() {
        if (!this.recordData) return [];
        
        const fields = [];
        Object.keys(this.recordData).forEach(key => {
            if (key !== 'Id' && key !== 'rowIndex') {
                const label = key.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
                const fieldType = this.getFieldType(key, label);
                const rawValue = this.recordData[key] || 'N/A';
                
                // Format the value based on field type
                let displayValue = rawValue;
                if (fieldType === 'amount') {
                    // Check if it's currency field (amount due)
                    if (key.toLowerCase().includes('amount') && key.toLowerCase().includes('due')) {
                        displayValue = this.formatCurrency(rawValue);
                    } else {
                        displayValue = this.formatNumber(rawValue);
                    }
                } else if (fieldType === 'date') {
                    displayValue = this.formatDate(rawValue);
                }
                
                fields.push({
                    key: key,
                    label: label,
                    value: displayValue,
                    type: fieldType
                });
            }
        });
        
        return fields;
    }
    
    /**
     * Format number with thousands separators
     */
    formatNumber(value) {
        if (value === 'N/A' || value === null || value === undefined) return 'N/A';
        
        const numValue = parseFloat(value);
        if (isNaN(numValue)) return value;
        
        return numValue.toLocaleString('en-US');
    }
    
    /**
     * Format currency value
     */
    formatCurrency(value) {
        if (value === 'N/A' || value === null || value === undefined) return 'N/A';
        
        const numValue = parseFloat(value);
        if (isNaN(numValue)) return value;
        
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(numValue);
    }
    
    /**
     * Format date value
     */
    formatDate(value) {
        if (value === 'N/A' || value === null || value === undefined) return 'N/A';
        
        try {
            const date = new Date(value);
            if (isNaN(date.getTime())) return value;
            
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: '2-digit'
            });
        } catch (e) {
            return value;
        }
    }
    
    /**
     * Determine field type for styling
     */
    getFieldType(key, label) {
        const keyLower = key.toLowerCase();
        const labelLower = label.toLowerCase();
        
        // Check for account-related fields
        if (keyLower.includes('account') || labelLower.includes('account')) {
            return 'account';
        }
        
        // Check for date-related fields
        if (keyLower.includes('date') || labelLower.includes('date') || keyLower.includes('due')) {
            return 'date';
        }
        
        // Check for amount/money fields
        if (keyLower.includes('amount') || keyLower.includes('total') || 
            keyLower.includes('cost') || keyLower.includes('price') ||
            keyLower.includes('kilowatt') || keyLower.includes('kwh')) {
            return 'amount';
        }
        
        return 'default';
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