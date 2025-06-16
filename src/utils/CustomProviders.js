import { NumericLabelProvider } from 'scichart/Charting/Visuals/Axis/LabelProvider/NumericLabelProvider';
import { NumericTickProvider } from 'scichart/Charting/Numerics/TickProviders/NumericTickProvider';
import { DateTime } from 'luxon';

// Custom label provider to display timestamps in Eastern Time
export class EasternTimeLabelProvider extends NumericLabelProvider {
    formatLabel(dataValue) {
        const dt = DateTime.fromMillis(dataValue).setZone('America/New_York');
        
        // Only show month/day if minutes are at the top of the hour (00)
        if (dt.minute === 0) {
            // Use M instead of MM to remove leading zero for single-digit months
            // Use / instead of - between month and day
            return dt.toFormat('M/dd HH:mm');
        } else {
            return dt.toFormat('HH:mm');
        }
    }
}

// Custom tick provider to adjust X-axis labels based on visible range
export class CustomTickProvider extends NumericTickProvider {
    constructor(wasmContext, candleInterval) {
        super(wasmContext);
        this.wasmContext = wasmContext;
        this.candleInterval = candleInterval; // e.g., 60000 for 1m, 300000 for 5m, etc.
    }

    getMajorTicks(deltminor, deltMajor, visRange) {
        if (!visRange) {
            console.warn('visibleRange is undefined, returning empty ticks');
            return [];
        }

        const visibleMin = visRange.min;
        const visibleMax = visRange.max;
        const durationMs = visibleMax - visibleMin;
        const durationHours = durationMs / (1000 * 60 * 60);

        let intervalMs;
        if (durationHours < 3) {
            intervalMs = 15 * 60 * 1000;
        } else if (durationHours < 12) {
            intervalMs = 60 * 60 * 1000;
        } else if (durationHours < 48) {
            intervalMs = 4 * 60 * 60 * 1000;
        } else {
            intervalMs = 24 * 60 * 60 * 1000;
        }

        const startTime = DateTime.fromMillis(visibleMin, { zone: 'America/New_York' });

        let tickStart;
        if (intervalMs === 15 * 60 * 1000) {
            const minutes = startTime.minute;
            const roundedMinutes = Math.floor(minutes / 15) * 15;
            tickStart = startTime.set({ minute: roundedMinutes, second: 0, millisecond: 0 });
        } else if (intervalMs === 60 * 60 * 1000) {
            tickStart = startTime.set({ minute: 0, second: 0, millisecond: 0 });
        } else if (intervalMs === 4 * 60 * 60 * 1000) {
            const hours = startTime.hour;
            const roundedHours = Math.floor(hours / 4) * 4;
            tickStart = startTime.set({ hour: roundedHours, minute: 0, second: 0, millisecond: 0 });
        } else {
            tickStart = startTime.startOf('day');
        }

        const ticks = [];
        let current = tickStart.toMillis();

        while (current <= visibleMax) {
            if (current >= visibleMin) {
                ticks.push(current);
            }
            current += intervalMs;
        }

        return ticks;
    }

    getMinorTicks(deltminor, deltMajor, visRange) {
        if (!visRange) {
            console.warn('visibleRange is undefined, returning empty ticks for minor');
            return [];
        }

        const visibleMin = visRange.min;
        const visibleMax = visRange.max;
        const start = Math.floor(visibleMin / this.candleInterval) * this.candleInterval;
        const ticks = [];
        for (let i = start; i <= visibleMax; i += this.candleInterval) {
            if (i >= visibleMin && i <= visibleMax) {
                ticks.push(i);
            }
        }
        return ticks;
    }
} 