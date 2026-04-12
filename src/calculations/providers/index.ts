import { WebWorkerProvider } from './webworker-provider';
import {
    MathProvider,
} from '../types';



let defaultMathProvider: MathProvider | null = null;

export function getDefaultMathProvider(): MathProvider {
    if (!defaultMathProvider) {
        defaultMathProvider = new WebWorkerProvider();
    }

    return defaultMathProvider;
}
