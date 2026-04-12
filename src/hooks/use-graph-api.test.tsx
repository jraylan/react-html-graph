import { render, waitFor } from "@testing-library/react";
import Graph from "../graph";
import type { MathProvider } from "../calculations/types";
import { createGraphApi } from "./use-graph-api";

function createMockMathProvider(): MathProvider {
    return {
        setup: jest.fn(),
        calculatePath: jest.fn().mockResolvedValue({
            pathD: "",
            bounds: { left: 0, top: 0, width: 0, height: 0 },
        }),
        calculateBidirectionalPath: jest.fn().mockResolvedValue({
            centerD: "",
            forwardD: "",
            reverseD: "",
            bounds: { left: 0, top: 0, width: 0, height: 0 },
        }),
        calculateLabels: jest.fn().mockResolvedValue([]),
        calculateBidirectionalLabels: jest.fn().mockResolvedValue([]),
        calculateLayout: jest.fn().mockResolvedValue({
            positions: [],
            bounds: { left: 0, top: 0, width: 0, height: 0 },
        }),
        calculateFitView: jest.fn().mockResolvedValue({
            x: 0,
            y: 0,
            zoom: 1,
            bounds: { left: 0, top: 0, width: 0, height: 0 },
        }),
        dispose: jest.fn().mockResolvedValue(undefined),
    };
}

describe("createGraphApi", () => {
    beforeAll(() => {
        class ResizeObserverMock {
            observe() { }
            disconnect() { }
            unobserve() { }
        }

        Object.defineProperty(globalThis, "ResizeObserver", {
            configurable: true,
            writable: true,
            value: ResizeObserverMock,
        });
    });

    it("troca o provider atual e descarta o anterior", async () => {
        const previousProvider = createMockMathProvider();
        const nextProvider = createMockMathProvider();
        const api = createGraphApi({ mathProvider: previousProvider });

        expect(api.getMathProvider()).toBe(previousProvider);

        await api.setMathProvider(nextProvider);

        expect(api.getMathProvider()).toBe(nextProvider);
        expect(previousProvider.dispose).toHaveBeenCalledTimes(1);
    });

    it("descarta o provider atual quando o Graph desmonta", async () => {
        const provider = createMockMathProvider();
        const api = createGraphApi({ mathProvider: provider });
        const { unmount } = render(<Graph api={api} mode="edit" />);

        unmount();

        await waitFor(() => {
            expect(provider.dispose).toHaveBeenCalledTimes(1);
        });
    });
});
