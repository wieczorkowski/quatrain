import { getReadableTextColor } from './chartUtils';

export const handleLiveCandleUpdate = (candle, timeframe, colors, dataSeries, lastPriceLine, sciChartSurface) => {
    //console.log(`DEBUG: Live update for ${timeframe}`);
    //console.log(`DEBUG: Colors: upCandleStroke=${colors.upCandleStroke}, downCandleStroke=${colors.downCandleStroke}`);
    
    if (!dataSeries) {
        console.warn(`Data series not found for ${timeframe} during live update.`);
        return;
    }

    if (typeof dataSeries.count !== 'function') {
        console.error(`Invalid dataSeries object for ${timeframe}:`, dataSeries);
        return;
    }

    const count = dataSeries.count();
    if (count > 0) {
        const lastTimestamp = dataSeries.getNativeXValues().get(count - 1);
        if (candle.timestamp === lastTimestamp) {
            dataSeries.removeAt(count - 1);
            dataSeries.append(
                Number(candle.timestamp),
                Number(candle.open),
                Number(candle.high),
                Number(candle.low),
                Number(candle.close)
            );
        } else if (candle.timestamp > lastTimestamp) {
            dataSeries.append(
                Number(candle.timestamp),
                Number(candle.open),
                Number(candle.high),
                Number(candle.low),
                Number(candle.close)
            );
        }
    } else {
        dataSeries.append(
            Number(candle.timestamp),
            Number(candle.open),
            Number(candle.high),
            Number(candle.low),
            Number(candle.close)
        );
    }

    if (sciChartSurface && lastPriceLine) {
        const isBullish = candle.close > candle.open;
        
        // Use current colors
        lastPriceLine.stroke = isBullish ? colors.upCandleStroke : colors.downCandleStroke;
        lastPriceLine.y1 = candle.close;
        lastPriceLine.labelValue = candle.close.toFixed(2);
        lastPriceLine.axisLabelFill = isBullish ? colors.upCandleFill : colors.downCandleFill;
        lastPriceLine.axisLabelStroke = getReadableTextColor(isBullish ? colors.upCandleFill : colors.downCandleFill);
        lastPriceLine.isHidden = false;
        sciChartSurface.invalidateElement();
        // DEBUGGING: console.log(`Last price line updated to ${candle.close} with color: ${lastPriceLine.stroke}`);
    } else {
        console.warn(`Could not update last price line:`, {
            lastPriceLineExists: !!lastPriceLine,
            sciChartSurfaceExists: !!sciChartSurface
        });
    }
}; 