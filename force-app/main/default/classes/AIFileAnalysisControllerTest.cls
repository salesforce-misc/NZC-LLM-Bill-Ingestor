/**
 * Tests energy-use record creation from LLM JSON, including account_number.
 */
@IsTest
private class AIFileAnalysisControllerTest {
    @IsTest
    static void createEnergyUseRecords_usesAccountNumberForName() {
        StnryAssetEnvrSrc source = new StnryAssetEnvrSrc(Name = 'Test Source');
        insert source;

        String jsonData = JSON.serialize(
            new List<Map<String, Object>>{
                new Map<String, Object>{
                    'account_number' => 'ACC-555',
                    'account' => 'Old Account',
                    'due_date' => '08/13/2026',
                    'kilowatts_consumed' => '123.45'
                }
            }
        );

        Test.startTest();
        List<AIFileAnalysisController.CreatedEnergyUse> createdIds =
            AIFileAnalysisController.createEnergyUseRecords(jsonData, source.Id);
        Test.stopTest();

        System.assertEquals(1, createdIds.size(), 'One energy use record should be created');
        StnryAssetEnrgyUse created = [
            SELECT Name, FuelConsumption, StartDate
            FROM StnryAssetEnrgyUse
            WHERE Id = :createdIds[0].id
        ];
        System.assert(
            created.Name.contains('ACC-555'),
            'Record name should prefer account_number: ' + created.Name
        );
        System.assertEquals(123.45, created.FuelConsumption);
        System.assertEquals(Date.newInstance(2026, 8, 13), created.StartDate);
    }

    @IsTest
    static void createEnergyUseRecords_fallsBackToAccountWhenNumberBlank() {
        StnryAssetEnvrSrc source = new StnryAssetEnvrSrc(Name = 'Fallback Source');
        insert source;

        String jsonData = JSON.serialize(
            new Map<String, Object>{
                'account' => 'Fallback Acct',
                'due_date' => '01/15/2026',
                'kilowatts_consumed' => '10'
            }
        );

        Test.startTest();
        List<AIFileAnalysisController.CreatedEnergyUse> createdIds =
            AIFileAnalysisController.createEnergyUseRecords(jsonData, source.Id);
        Test.stopTest();

        System.assertEquals(1, createdIds.size(), 'One energy use record should be created');
        StnryAssetEnrgyUse created = [
            SELECT Name
            FROM StnryAssetEnrgyUse
            WHERE Id = :createdIds[0].id
        ];
        System.assert(
            created.Name.contains('Fallback Acct'),
            'Record name should fall back to account: ' + created.Name
        );
    }

    @IsTest
    static void createEnergyUseRecords_createsElectricityAndNaturalGas() {
        StnryAssetEnvrSrc source = new StnryAssetEnvrSrc(Name = 'Dual Fuel Source');
        insert source;

        String jsonData = JSON.serialize(
            new Map<String, Object>{
                'account_number' => 'ACC-GAS',
                'due_date' => '08/13/2026',
                'kilowatts_consumed' => '2440',
                'therms_consumed' => '125.5'
            }
        );

        Test.startTest();
        List<AIFileAnalysisController.CreatedEnergyUse> created =
            AIFileAnalysisController.createEnergyUseRecords(jsonData, source.Id);
        Test.stopTest();

        System.assertEquals(2, created.size(), 'Electricity and Natural Gas records should be created');
        System.assertEquals('Electricity', created[0].fuelType);
        System.assertEquals('NaturalGas', created[1].fuelType);

        Map<Id, StnryAssetEnrgyUse> idToRecord = new Map<Id, StnryAssetEnrgyUse>([
            SELECT FuelType, FuelConsumption, Name
            FROM StnryAssetEnrgyUse
            WHERE Id IN :new List<Id>{ created[0].id, created[1].id }
        ]);
        System.assertEquals(2440, idToRecord.get(created[0].id).FuelConsumption);
        System.assertEquals(125.5, idToRecord.get(created[1].id).FuelConsumption);
        System.assert(
            idToRecord.get(created[1].id).Name.contains('Natural Gas'),
            'Gas record name should include Natural Gas: ' + idToRecord.get(created[1].id).Name
        );
    }

    @IsTest
    static void createEnergyUseRecords_skipsZeroTherms() {
        StnryAssetEnvrSrc source = new StnryAssetEnvrSrc(Name = 'Zero Gas Source');
        insert source;

        String jsonData = JSON.serialize(
            new Map<String, Object>{
                'account_number' => 'ACC-ZERO',
                'due_date' => '08/13/2026',
                'kilowatts_consumed' => '10',
                'therms_consumed' => '0'
            }
        );

        Test.startTest();
        List<AIFileAnalysisController.CreatedEnergyUse> created =
            AIFileAnalysisController.createEnergyUseRecords(jsonData, source.Id);
        Test.stopTest();

        System.assertEquals(1, created.size(), 'Zero therms should not create a gas record');
        System.assertEquals('Electricity', created[0].fuelType);
    }

    @IsTest
    static void createEnergyUseRecords_createsGasOnlyWhenNoKilowatts() {
        StnryAssetEnvrSrc source = new StnryAssetEnvrSrc(Name = 'Gas Only Source');
        insert source;

        String jsonData = JSON.serialize(
            new Map<String, Object>{
                'account_number' => 'ACC-ONLY-GAS',
                'due_date' => '08/13/2026',
                'therms_consumed' => '80'
            }
        );

        Test.startTest();
        List<AIFileAnalysisController.CreatedEnergyUse> created =
            AIFileAnalysisController.createEnergyUseRecords(jsonData, source.Id);
        Test.stopTest();

        System.assertEquals(1, created.size(), 'Only a Natural Gas record should be created');
        System.assertEquals('NaturalGas', created[0].fuelType);
    }

    @IsTest
    static void createEnergyUseRecords_namesElectricityWhenAccountAndDueDateBlank() {
        StnryAssetEnvrSrc source = new StnryAssetEnvrSrc(Name = 'Blank Name Source');
        insert source;

        String jsonData = JSON.serialize(
            new Map<String, Object>{
                'account' => '',
                'account_number' => '',
                'due_date' => '',
                'kilowatts_consumed' => '1010',
                'therms_consumed' => ''
            }
        );

        Test.startTest();
        List<AIFileAnalysisController.CreatedEnergyUse> created =
            AIFileAnalysisController.createEnergyUseRecords(jsonData, source.Id);
        Test.stopTest();

        System.assertEquals(1, created.size(), 'Electricity should still be created');
        StnryAssetEnrgyUse createdRow = [
            SELECT Name, FuelType
            FROM StnryAssetEnrgyUse
            WHERE Id = :created[0].id
        ];
        System.assertEquals('Electricity', createdRow.FuelType);
        System.assertEquals('Electricity', createdRow.Name);
    }
}
