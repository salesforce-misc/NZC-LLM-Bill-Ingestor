import { createElement } from "lwc";
import ImageAnalyzer from "c/imageAnalyzer";
import analyzeFiles from "@salesforce/apex/AIFileAnalysisController.analyzeFiles";
import createEnergyUseRecords from "@salesforce/apex/AIFileAnalysisController.createEnergyUseRecords";
import getRelatedFiles from "@salesforce/apex/AIFileAnalysisController.getRelatedFiles";

jest.mock(
  "@salesforce/apex/AIFileAnalysisController.analyzeFiles",
  () => ({ default: jest.fn() }),
  { virtual: true }
);

jest.mock(
  "@salesforce/apex/AIFileAnalysisController.createEnergyUseRecords",
  () => ({ default: jest.fn() }),
  { virtual: true }
);

jest.mock(
  "@salesforce/apex/AIFileAnalysisController.getRelatedFiles",
  () => {
    const { createApexTestWireAdapter } = require("@salesforce/sfdx-lwc-jest");
    return { default: createApexTestWireAdapter(jest.fn()) };
  },
  { virtual: true }
);

const SAMPLE_ROW = {
  account_number: "111",
  due_date: "08/01/2026",
  kilowatts_consumed: 100,
  therms_consumed: 0,
  mailing_address: "1 Main St",
  amount_due: 50
};

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

function getButton(element, label) {
  return [...element.shadowRoot.querySelectorAll("lightning-button")].find(
    (button) => button.label === label
  );
}

async function analyzeUploadedFile(element, aiJson) {
  analyzeFiles.mockResolvedValue(aiJson);
  const upload = element.shadowRoot.querySelector("lightning-file-upload");
  upload.dispatchEvent(
    new CustomEvent("uploadfinished", {
      detail: {
        files: [{ documentId: "069XX0000000001", name: "bill.pdf" }]
      }
    })
  );
  await flushPromises();
  getButton(element, "Analyze Selected File").click();
  await flushPromises();
}

function createComponent() {
  const element = createElement("c-image-analyzer", { is: ImageAnalyzer });
  element.recordId = "a0lXX0000000001";
  document.body.appendChild(element);
  getRelatedFiles.emit([]);
  return element;
}

describe("c-image-analyzer", () => {
  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it("marks review columns editable on array results", async () => {
    const element = createComponent();
    await analyzeUploadedFile(element, JSON.stringify([SAMPLE_ROW]));

    const datatable = element.shadowRoot.querySelector("lightning-datatable");
    expect(datatable).not.toBeNull();

    const hint = element.shadowRoot.querySelector(".ai-table-hint");
    expect(hint.textContent).toContain("correct extracted values");

    const editableFields = datatable.columns
      .filter((column) => column.editable)
      .map((column) => column.fieldName);
    expect(editableFields).toEqual(
      expect.arrayContaining([
        "account_number",
        "due_date",
        "kilowatts_consumed",
        "therms_consumed"
      ])
    );
  });

  it("sends saved cell edits to createEnergyUseRecords and keeps extra keys", async () => {
    const element = createComponent();
    await analyzeUploadedFile(element, JSON.stringify([SAMPLE_ROW]));

    const datatable = element.shadowRoot.querySelector("lightning-datatable");
    datatable.dispatchEvent(
      new CustomEvent("save", {
        detail: {
          draftValues: [
            {
              Id: "item-0",
              kilowatts_consumed: 250.5,
              account_number: "999"
            }
          ]
        }
      })
    );
    await flushPromises();

    createEnergyUseRecords.mockResolvedValue([
      { id: "a1lXX0000000001", fuelType: "Electricity" }
    ]);
    getButton(element, "Create Energy Records").click();
    await flushPromises();

    expect(createEnergyUseRecords).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(
      createEnergyUseRecords.mock.calls[0][0].jsonData
    );
    expect(payload).toHaveLength(1);
    expect(payload[0].kilowatts_consumed).toBe(250.5);
    expect(payload[0].account_number).toBe("999");
    expect(payload[0].mailing_address).toBe("1 Main St");
    expect(payload[0].amount_due).toBe(50);
    expect(payload[0].due_date).toBe("08/01/2026");
    expect(payload[0].Id).toBeUndefined();
    expect(payload[0].rowIndex).toBeUndefined();
  });

  it("applies unsaved draft values when creating records", async () => {
    const element = createComponent();
    await analyzeUploadedFile(element, JSON.stringify([SAMPLE_ROW]));

    const datatable = element.shadowRoot.querySelector("lightning-datatable");
    datatable.dispatchEvent(
      new CustomEvent("cellchange", {
        detail: {
          draftValues: [{ Id: "item-0", kilowatts_consumed: 300 }]
        }
      })
    );
    await flushPromises();

    createEnergyUseRecords.mockResolvedValue([
      { id: "a1lXX0000000001", fuelType: "Electricity" }
    ]);
    getButton(element, "Create Energy Records").click();
    await flushPromises();

    const payload = JSON.parse(
      createEnergyUseRecords.mock.calls[0][0].jsonData
    );
    expect(payload[0].kilowatts_consumed).toBe(300);
    expect(payload[0].mailing_address).toBe("1 Main St");
  });

  it("sends single-object input edits to createEnergyUseRecords", async () => {
    const element = createComponent();
    await analyzeUploadedFile(
      element,
      JSON.stringify({
        account_number: "111",
        kilowatts_consumed: 100,
        mailing_address: "1 Main St"
      })
    );

    const kwhInput = element.shadowRoot.querySelector(
      'lightning-input[data-field-key="kilowatts_consumed"]'
    );
    expect(kwhInput).not.toBeNull();
    kwhInput.value = "888";
    kwhInput.dispatchEvent(new CustomEvent("change"));
    await flushPromises();

    createEnergyUseRecords.mockResolvedValue([
      { id: "a1lXX0000000001", fuelType: "Electricity" }
    ]);
    getButton(element, "Create Energy Records").click();
    await flushPromises();

    const payload = JSON.parse(
      createEnergyUseRecords.mock.calls[0][0].jsonData
    );
    expect(payload.kilowatts_consumed).toBe(888);
    expect(payload.mailing_address).toBe("1 Main St");
    expect(payload.account_number).toBe("111");
  });

  it("shows a success toast with a link to the created record", async () => {
    const element = createComponent();
    await analyzeUploadedFile(
      element,
      JSON.stringify({
        account_number: "111",
        kilowatts_consumed: 100
      })
    );

    const handler = jest.fn();
    element.addEventListener("lightning__showtoast", handler);

    createEnergyUseRecords.mockResolvedValue([
      { id: "a1lXX0000000001", fuelType: "Electricity" }
    ]);
    getButton(element, "Create Energy Records").click();
    await flushPromises();

    const successToast = handler.mock.calls
      .map((call) => call[0].detail)
      .find((detail) => detail.title === "Success");
    expect(successToast).toBeDefined();
    expect(successToast.message).toContain("{0}");
    expect(successToast.messageData[0].url).toBe("/a1lXX0000000001");
    expect(successToast.messageData[0].label).toBe("View record");
    expect(successToast.duration).toBe(15000);
  });

  it("shows a toast link for each created electricity and gas record", async () => {
    const element = createComponent();
    await analyzeUploadedFile(
      element,
      JSON.stringify({
        account_number: "111",
        kilowatts_consumed: 100,
        therms_consumed: 80
      })
    );

    const handler = jest.fn();
    element.addEventListener("lightning__showtoast", handler);

    createEnergyUseRecords.mockResolvedValue([
      { id: "a1lXX0000000001", fuelType: "Electricity" },
      { id: "a1lXX0000000002", fuelType: "NaturalGas" }
    ]);
    getButton(element, "Create Energy Records").click();
    await flushPromises();

    const successToast = handler.mock.calls
      .map((call) => call[0].detail)
      .find((detail) => detail.title === "Success");
    expect(successToast.message).toBe(
      "Successfully created 2 Energy Use records! {0} {1}"
    );
    expect(successToast.messageData).toEqual([
      { url: "/a1lXX0000000001", label: "View Electricity record" },
      { url: "/a1lXX0000000002", label: "View Natural Gas record" }
    ]);
  });

  it("resets to the original state 15 seconds after a successful create", async () => {
    jest.useFakeTimers();
    const element = createComponent();
    await analyzeUploadedFile(
      element,
      JSON.stringify({
        account_number: "111",
        kilowatts_consumed: 100
      })
    );

    expect(element.shadowRoot.querySelector(".ai-result")).not.toBeNull();
    expect(element.shadowRoot.querySelector(".ai-uploaded-file")).not.toBeNull();

    createEnergyUseRecords.mockResolvedValue([
      { id: "a1lXX0000000001", fuelType: "Electricity" }
    ]);
    getButton(element, "Create Energy Records").click();
    await flushPromises();

    expect(element.shadowRoot.querySelector(".ai-result")).not.toBeNull();

    jest.advanceTimersByTime(14999);
    await flushPromises();
    expect(element.shadowRoot.querySelector(".ai-result")).not.toBeNull();

    jest.advanceTimersByTime(1);
    await flushPromises();
    expect(element.shadowRoot.querySelector(".ai-result")).toBeNull();
    expect(element.shadowRoot.querySelector(".ai-uploaded-file")).toBeNull();
    expect(getButton(element, "Analyze Selected File").disabled).toBe(true);

    jest.useRealTimers();
  });
});
