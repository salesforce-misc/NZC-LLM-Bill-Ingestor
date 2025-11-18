public with sharing class AIFileAnalysisController {
    
    /**
     * Wrapper class to format file data for the LWC's combobox component.
     */
    public class FileOption {
        @AuraEnabled
        public String label {get; set;} // This will be the file name
        @AuraEnabled
        public String value {get; set;} // This will be the file's ID

        public FileOption(String label, String value) {
            this.label = label;
            this.value = value;
        }
    }
    
    /**
     * NEW: This method returns the base URL for the current Salesforce org.
     * This is used to construct an absolute URL for flow navigation, making it more reliable.
     * @return String representing the org's base URL (e.g., https://yourdomain.lightning.force.com)
     */
    @AuraEnabled(cacheable=true)
    public static String getOrgBaseUrl() {
        return URL.getOrgDomainUrl().toExternalForm();
    }

    @AuraEnabled(cacheable=true)
    public static List<FileOption> getRelatedFiles(String recordId) {
        List<FileOption> options = new List<FileOption>();
        Set<Id> contentDocumentIds = new Set<Id>();

        // Check permissions for ContentDocumentLink
        if (!Schema.sObjectType.ContentDocumentLink.isAccessible()) {
            throw new AuraHandledException('Access denied to ContentDocumentLink');
        }

        for (ContentDocumentLink cdl : [
            SELECT ContentDocumentId 
            FROM ContentDocumentLink 
            WHERE LinkedEntityId = :recordId
        ]) {
            contentDocumentIds.add(cdl.ContentDocumentId);
        }

        if (!contentDocumentIds.isEmpty()) {
            // Check permissions for ContentDocument
            if (!Schema.sObjectType.ContentDocument.isAccessible()) {
                throw new AuraHandledException('Access denied to ContentDocument');
            }
            
            for (ContentDocument cd : [
                SELECT Id, Title 
                FROM ContentDocument 
                WHERE Id IN :contentDocumentIds
                ORDER BY Title ASC
            ]) {
                options.add(new FileOption(cd.Title, cd.Id));
            }
        }
        return options;
    }

    @AuraEnabled(cacheable=false)
    public static String analyzeFiles(String fileId) {
        try {
            ConnectApi.EinsteinPromptTemplateGenerationsInput promptInput = new ConnectApi.EinsteinPromptTemplateGenerationsInput();
            promptInput.isPreview = false;

            Map<String, String> cMap = new Map<String, String>();
            cMap.put('id', fileId);

            ConnectApi.WrappedValue cWrapped = new ConnectApi.WrappedValue();
            cWrapped.value = cMap;

            Map<String, ConnectApi.WrappedValue> inputValues = new Map<String, ConnectApi.WrappedValue>();
            inputValues.put('Input:Analyze_Files', cWrapped);

            promptInput.inputParams = inputValues;
            
            promptInput.additionalConfig = new ConnectApi.EinsteinLlmAdditionalConfigInput();
            promptInput.additionalConfig.applicationName = 'PromptTemplateGenerationsInvocable';

            ConnectApi.EinsteinPromptTemplateGenerationsRepresentation result = 
                ConnectApi.EinsteinLLM.generateMessagesForPromptTemplate('Analyze_Files', promptInput);
            
            return result.generations[0].text;

        } catch (Exception e) {
            return 'Error: ' + e.getMessage();
        }
    }

    /**
     * Creates StnryAssetEnrgyUse records from JSON analysis data
     * @param jsonData The JSON string containing analysis results
     * @param recordId The record ID to associate with the energy use records
     * @return List of created record IDs
     */
    @AuraEnabled
    public static List<String> createEnergyUseRecords(String jsonData, String recordId) {
        // Check permissions first
        if (!Schema.sObjectType.StnryAssetEnrgyUse.isCreateable()) {
            throw new AuraHandledException('Access denied to create StnryAssetEnrgyUse records');
        }
        
        try {
            String cleanedJson = cleanJsonData(jsonData);
            Object parsedJson = JSON.deserializeUntyped(cleanedJson);
            List<StnryAssetEnrgyUse> recordsToInsert = processJsonData(parsedJson, recordId);
            
            return insertEnergyUseRecords(recordsToInsert);
            
        } catch (Exception e) {
            throw new AuraHandledException('Error creating energy use records: ' + e.getMessage());
        }
    }
    
    /**
     * Helper method to clean JSON data
     */
    private static String cleanJsonData(String jsonData) {
        return jsonData.replace('```json\n', '').replace('\n```', '').trim();
    }
    
    /**
     * Helper method to process JSON data and return list of records
     */
    private static List<StnryAssetEnrgyUse> processJsonData(Object parsedJson, String recordId) {
        List<StnryAssetEnrgyUse> recordsToInsert = new List<StnryAssetEnrgyUse>();
        
        if (parsedJson instanceof List<Object>) {
            recordsToInsert = processMultipleSites((List<Object>) parsedJson, recordId);
        } else if (parsedJson instanceof Map<String, Object>) {
            StnryAssetEnrgyUse newRecord = createEnergyUseRecord((Map<String, Object>) parsedJson, recordId);
            if (newRecord != null) {
                recordsToInsert.add(newRecord);
            }
        }
        
        return recordsToInsert;
    }
    
    /**
     * Helper method to process multiple sites
     */
    private static List<StnryAssetEnrgyUse> processMultipleSites(List<Object> sites, String recordId) {
        List<StnryAssetEnrgyUse> records = new List<StnryAssetEnrgyUse>();
        
        for (Object siteObj : sites) {
            if (siteObj instanceof Map<String, Object>) {
                Map<String, Object> site = (Map<String, Object>) siteObj;
                StnryAssetEnrgyUse newRecord = createEnergyUseRecord(site, recordId);
                if (newRecord != null) {
                    records.add(newRecord);
                }
            }
        }
        
        return records;
    }
    
    /**
     * Helper method to insert records and return IDs
     */
    private static List<String> insertEnergyUseRecords(List<StnryAssetEnrgyUse> recordsToInsert) {
        List<String> createdRecordIds = new List<String>();
        
        if (!recordsToInsert.isEmpty()) {
            // Check FLS permissions for INSERT operation on all fields being set
            if (!Schema.sObjectType.StnryAssetEnrgyUse.fields.FuelConsumption.isCreateable() ||
                !Schema.sObjectType.StnryAssetEnrgyUse.fields.FuelType.isCreateable() ||
                !Schema.sObjectType.StnryAssetEnrgyUse.fields.Name.isCreateable() ||
                !Schema.sObjectType.StnryAssetEnrgyUse.fields.StartDate.isCreateable() ||
                !Schema.sObjectType.StnryAssetEnrgyUse.fields.StnryAssetEnvrSrcId.isCreateable()) {
                throw new AuraHandledException('Insufficient permissions to create StnryAssetEnrgyUse records with required fields');
            }
            
            insert recordsToInsert;
            for (StnryAssetEnrgyUse record : recordsToInsert) {
                createdRecordIds.add(record.Id);
            }
        }
        
        return createdRecordIds;
    }
    
    /**
     * Helper method to create a single StnryAssetEnrgyUse record from site data
     * @param site Map containing the site data
     * @param recordId The record ID to associate with the energy use record
     * @return StnryAssetEnrgyUse record or null if required data is missing
     */
    private static StnryAssetEnrgyUse createEnergyUseRecord(Map<String, Object> site, String recordId) {
        try {
            SiteData siteData = extractSiteData(site);
            StnryAssetEnrgyUse energyUseRecord = new StnryAssetEnrgyUse();
            
            // Set required fields
            if (String.isNotBlank(siteData.kilowatts)) {
                energyUseRecord.FuelConsumption = Decimal.valueOf(siteData.kilowatts);
            }
            
            energyUseRecord.FuelType = 'Electricity';
            energyUseRecord.StnryAssetEnvrSrcId = recordId;
            energyUseRecord.Name = buildRecordName(siteData.account, siteData.dueDate);
            energyUseRecord.StartDate = parseDueDateString(siteData.dueDate);
            
            return energyUseRecord;
            
        } catch (Exception e) {
            return null;
        }
    }
    
    /**
     * Helper class to hold extracted site data
     */
    private class SiteData {
        String kilowatts;
        String chargeAmount;
        String dueDate;
        String account;
        
        SiteData() {
            // Default constructor for builder pattern
        }
        
        SiteData withKilowatts(String kilowatts) {
            this.kilowatts = kilowatts;
            return this;
        }
        
        SiteData withChargeAmount(String chargeAmount) {
            this.chargeAmount = chargeAmount;
            return this;
        }
        
        SiteData withDueDate(String dueDate) {
            this.dueDate = dueDate;
            return this;
        }
        
        SiteData withAccount(String account) {
            this.account = account;
            return this;
        }
    }
    
    /**
     * Extracts site data from JSON map
     */
    private static SiteData extractSiteData(Map<String, Object> site) {
        return new SiteData()
            .withKilowatts(getStringValue(site.get('kilowatts_consumed')))
            .withChargeAmount(getStringValue(site.get('charge_amount_electricity')))
            .withDueDate(getStringValue(site.get('due_date')))
            .withAccount(getStringValue(site.get('account')));
    }
    
    /**
     * Builds record name from account and due date
     */
    private static String buildRecordName(String account, String dueDate) {
        String recordName = '';
        if (String.isNotBlank(account)) {
            recordName += account;
        }
        if (String.isNotBlank(dueDate)) {
            recordName += (String.isNotBlank(recordName) ? ' ' : '') + dueDate;
        }
        return String.isNotBlank(recordName) ? recordName : null;
    }
    
    /**
     * Parses due date string with multiple format support
     * Supports: MM/DD/YYYY, MM/DD/YY, MM-DD-YYYY, MM-DD-YY
     */
    private static Date parseDueDateString(String dueDate) {
        if (String.isBlank(dueDate)) {
            return null;
        }
        
        try {
            List<String> dateParts = splitDateString(dueDate.trim());
            if (dateParts.size() != 3) {
                return Date.today(); // Fallback for invalid format
            }
            
            Integer month = Integer.valueOf(dateParts[0].trim());
            Integer day = Integer.valueOf(dateParts[1].trim());
            Integer year = normalizeYear(Integer.valueOf(dateParts[2].trim()));
            
            return isValidDate(month, day, year) ? 
                Date.newInstance(year, month, day) : Date.today();
                
        } catch (Exception dateEx) {
            return Date.today(); // Fallback to today's date
        }
    }
    
    /**
     * Splits date string by common delimiters
     */
    private static List<String> splitDateString(String dateStr) {
        if (dateStr.contains('/')) {
            return dateStr.split('/');
        } else if (dateStr.contains('-')) {
            return dateStr.split('-');
        }
        return new List<String>();
    }
    
    /**
     * Converts 2-digit years to 4-digit years
     */
    private static Integer normalizeYear(Integer year) {
        if (year < 100) {
            // Assume years 00-30 are 2000-2030, 31-99 are 1931-1999
            return year <= 30 ? year + 2000 : year + 1900;
        }
        return year;
    }
    
    /**
     * Validates date components
     */
    private static Boolean isValidDate(Integer month, Integer day, Integer year) {
        return month >= 1 && month <= 12 && 
               day >= 1 && day <= 31 && 
               year >= 1900 && year <= 2100;
    }
    
    /**
     * Helper method to safely get string value from an object
     * @param obj The object to convert to string
     * @return String value or null
     */
    private static String getStringValue(Object obj) {
        if (obj == null) {
            return null;
        }
        return String.valueOf(obj);
    }
}
