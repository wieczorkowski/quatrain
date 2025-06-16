import React from 'react';
import ChartPane from './ChartPane';

const ChartLayout = ({
  chartLayout,
  timeframes,
  instrument,
  chartData,
  settings,
  isCrosshairMode,
  isLineMode,
  isBoxMode,
  isTrendMode,
  isArrowMode,
  isTextMode,
  isDrawingLockMode,
  lineColor,
  lineType,
  showLabel,
  lineOrientation,
  setIsLineMode,
  setIsBoxMode,
  setIsTrendMode,
  setIsArrowMode,
  setIsTextMode,
  boxOpacity,
  arrowDirection,
  arrowSize,
  arrowStyle,
  annotationText,
  fontSize,
  textAnchor,
  setDataSeriesRef,
  setLastPriceLineRef,
  setSciChartSurfaceRef,
  onAnnotationCreated,
  onAnnotationUpdated,
  onAnnotationDeleted,
  createAnnotationId,
  handleCrosshairMove,
  isLiveMode,
  isReplayMode,
  handleMouseDown,
  windowSize,
  rowSplitRatio,
  columnSplitRatio,
  columnSplitRatios,
}) => {
  // Calculate layout dimensions
  const dividerHeight = 10;
  const dividerWidth = 10;
  const availableHeight = windowSize.height - dividerHeight;
  const topHeight = (availableHeight * rowSplitRatio) / 100;
  const bottomHeight = availableHeight - topHeight;
  const availableWidth = windowSize.width - dividerWidth;
  
  // Different width calculations based on layout
  let leftWidth, centerWidth, rightWidth;
  
  if (chartLayout === '4-way') {
    // For 4-way layout, we only need left and right widths
    leftWidth = Math.floor((availableWidth * columnSplitRatio) / 100);
    rightWidth = availableWidth - leftWidth;
    centerWidth = 0; // Not used in 4-way layout
  } else {
    // For 6-way layout, we need 3 sections
    const firstDividerPosition = Math.floor((availableWidth * columnSplitRatios[0]) / 100);
    const secondDividerPosition = Math.floor((availableWidth * columnSplitRatios[1]) / 100);
    
    leftWidth = firstDividerPosition;
    centerWidth = secondDividerPosition - firstDividerPosition - dividerWidth;
    // Make sure rightWidth extends to the edge by using window width directly
    rightWidth = windowSize.width - secondDividerPosition - dividerWidth;
  }

  return (
    <>
      <div style={{ display: 'flex', height: `${topHeight}px` }}>
        {chartLayout === '4-way' ? (
          // 4-way layout - top row (2 charts)
          <>
            <div style={{ width: `${leftWidth}px`, position: 'relative' }}>
              <div style={{
                position: 'absolute',
                top: 5,
                left: 5,
                padding: '3px 8px',
                backgroundColor: '#000',
                color: '#fff',
                fontWeight: 'bold',
                zIndex: 50,
                borderRadius: '4px',
                fontSize: '14px',
              }}>
                {instrument} {timeframes[0]}
              </div>
              <ChartPane
                instrument={instrument}
                timeframe={timeframes[0]}
                candleData={chartData[timeframes[0]]}
                chartBehavior={settings.chartBehavior[timeframes[0]]}
                colors={settings.colors}
                gridOptions={settings.gridOptions}
                candleWidth={settings.candleWidth}
                chartType={settings.chartTypes ? settings.chartTypes[timeframes[0]] : 'Candle'}
                isCrosshairMode={isCrosshairMode}
                isLineMode={isLineMode}
                isBoxMode={isBoxMode}
                isTrendMode={isTrendMode}
                isArrowMode={isArrowMode}
                isTextMode={isTextMode}
                isDrawingLockMode={isDrawingLockMode}
                lineColor={lineColor}
                lineType={lineType}
                showLabel={showLabel}
                lineOrientation={lineOrientation}
                setIsLineMode={setIsLineMode}
                setIsBoxMode={setIsBoxMode}
                setIsTrendMode={setIsTrendMode}
                setIsArrowMode={setIsArrowMode}
                setIsTextMode={setIsTextMode}
                boxOpacity={boxOpacity}
                arrowDirection={arrowDirection}
                arrowSize={arrowSize}
                arrowStyle={arrowStyle}
                annotationText={annotationText}
                fontSize={fontSize}
                textAnchor={textAnchor}
                setDataSeriesRef={setDataSeriesRef}
                setLastPriceLineRef={setLastPriceLineRef}
                setSciChartSurfaceRef={setSciChartSurfaceRef}
                livePrice={chartData[timeframes[0]][chartData[timeframes[0]].length - 1]}
                onAnnotationCreated={onAnnotationCreated}
                onAnnotationUpdated={onAnnotationUpdated}
                onAnnotationDeleted={onAnnotationDeleted}
                generateAnnotationId={(type) => createAnnotationId(type, timeframes[0])}
                onCrosshairMove={(timeframe, timestamp, price) => handleCrosshairMove(timeframe, timestamp, price)}
                isLiveMode={isLiveMode}
                isReplayMode={isReplayMode}
              />
            </div>
            <div
              className="vertical-divider"
              style={{ width: `${dividerWidth}px`, cursor: 'ew-resize' }}
              onMouseDown={handleMouseDown('vertical')}
            />
            <div style={{ width: `${rightWidth}px`, position: 'relative', overflow: 'hidden' }}>
              <div style={{
                position: 'absolute',
                top: 5,
                left: 5,
                padding: '3px 8px',
                backgroundColor: '#000',
                color: '#fff',
                fontWeight: 'bold',
                zIndex: 50,
                borderRadius: '4px',
                fontSize: '14px',
              }}>
                {instrument} {timeframes[1]}
              </div>
              <ChartPane
                instrument={instrument}
                timeframe={timeframes[1]}
                candleData={chartData[timeframes[1]]}
                chartBehavior={settings.chartBehavior[timeframes[1]]}
                colors={settings.colors}
                gridOptions={settings.gridOptions}
                candleWidth={settings.candleWidth}
                chartType={settings.chartTypes ? settings.chartTypes[timeframes[1]] : 'Candle'}
                isCrosshairMode={isCrosshairMode}
                isLineMode={isLineMode}
                isBoxMode={isBoxMode}
                isTrendMode={isTrendMode}
                isArrowMode={isArrowMode}
                isTextMode={isTextMode}
                isDrawingLockMode={isDrawingLockMode}
                lineColor={lineColor}
                lineType={lineType}
                showLabel={showLabel}
                lineOrientation={lineOrientation}
                setIsLineMode={setIsLineMode}
                setIsBoxMode={setIsBoxMode}
                setIsTrendMode={setIsTrendMode}
                setIsArrowMode={setIsArrowMode}
                setIsTextMode={setIsTextMode}
                boxOpacity={boxOpacity}
                arrowDirection={arrowDirection}
                arrowSize={arrowSize}
                arrowStyle={arrowStyle}
                annotationText={annotationText}
                fontSize={fontSize}
                textAnchor={textAnchor}
                setDataSeriesRef={setDataSeriesRef}
                setLastPriceLineRef={setLastPriceLineRef}
                setSciChartSurfaceRef={setSciChartSurfaceRef}
                livePrice={chartData[timeframes[1]][chartData[timeframes[1]].length - 1]}
                onAnnotationCreated={onAnnotationCreated}
                onAnnotationUpdated={onAnnotationUpdated}
                onAnnotationDeleted={onAnnotationDeleted}
                generateAnnotationId={(type) => createAnnotationId(type, timeframes[1])}
                onCrosshairMove={(timeframe, timestamp, price) => handleCrosshairMove(timeframe, timestamp, price)}
                isLiveMode={isLiveMode}
                isReplayMode={isReplayMode}
              />
            </div>
          </>
        ) : (
          // 6-way layout - top row (3 charts)
          <>
            <div style={{ width: `${leftWidth}px`, position: 'relative' }}>
              <div style={{
                position: 'absolute',
                top: 5,
                left: 5,
                padding: '3px 8px',
                backgroundColor: '#000',
                color: '#fff',
                fontWeight: 'bold',
                zIndex: 50,
                borderRadius: '4px',
                fontSize: '14px',
              }}>
                {instrument} {timeframes[0]}
              </div>
              <ChartPane
                instrument={instrument}
                timeframe={timeframes[0]}
                candleData={chartData[timeframes[0]]}
                chartBehavior={settings.chartBehavior[timeframes[0]]}
                colors={settings.colors}
                gridOptions={settings.gridOptions}
                candleWidth={settings.candleWidth}
                chartType={settings.chartTypes ? settings.chartTypes[timeframes[0]] : 'Candle'}
                isCrosshairMode={isCrosshairMode}
                isLineMode={isLineMode}
                isBoxMode={isBoxMode}
                isTrendMode={isTrendMode}
                isArrowMode={isArrowMode}
                isTextMode={isTextMode}
                isDrawingLockMode={isDrawingLockMode}
                lineColor={lineColor}
                lineType={lineType}
                showLabel={showLabel}
                lineOrientation={lineOrientation}
                setIsLineMode={setIsLineMode}
                setIsBoxMode={setIsBoxMode}
                setIsTrendMode={setIsTrendMode}
                setIsArrowMode={setIsArrowMode}
                setIsTextMode={setIsTextMode}
                boxOpacity={boxOpacity}
                arrowDirection={arrowDirection}
                arrowSize={arrowSize}
                arrowStyle={arrowStyle}
                annotationText={annotationText}
                fontSize={fontSize}
                textAnchor={textAnchor}
                setDataSeriesRef={setDataSeriesRef}
                setLastPriceLineRef={setLastPriceLineRef}
                setSciChartSurfaceRef={setSciChartSurfaceRef}
                livePrice={chartData[timeframes[0]][chartData[timeframes[0]].length - 1]}
                onAnnotationCreated={onAnnotationCreated}
                onAnnotationUpdated={onAnnotationUpdated}
                onAnnotationDeleted={onAnnotationDeleted}
                generateAnnotationId={(type) => createAnnotationId(type, timeframes[0])}
                onCrosshairMove={(timeframe, timestamp, price) => handleCrosshairMove(timeframe, timestamp, price)}
                isLiveMode={isLiveMode}
                isReplayMode={isReplayMode}
              />
            </div>
            <div
              className="vertical-divider"
              style={{ width: `${dividerWidth}px`, cursor: 'ew-resize' }}
              onMouseDown={handleMouseDown('vertical', 0)}
            />
            <div style={{ width: `${centerWidth}px`, position: 'relative' }}>
              <div style={{
                position: 'absolute',
                top: 5,
                left: 5,
                padding: '3px 8px',
                backgroundColor: '#000',
                color: '#fff',
                fontWeight: 'bold',
                zIndex: 50,
                borderRadius: '4px',
                fontSize: '14px',
              }}>
                {instrument} {timeframes[1]}
              </div>
              <ChartPane
                instrument={instrument}
                timeframe={timeframes[1]}
                candleData={chartData[timeframes[1]]}
                chartBehavior={settings.chartBehavior[timeframes[1]]}
                colors={settings.colors}
                gridOptions={settings.gridOptions}
                candleWidth={settings.candleWidth}
                chartType={settings.chartTypes ? settings.chartTypes[timeframes[1]] : 'Candle'}
                isCrosshairMode={isCrosshairMode}
                isLineMode={isLineMode}
                isBoxMode={isBoxMode}
                isTrendMode={isTrendMode}
                isArrowMode={isArrowMode}
                isTextMode={isTextMode}
                isDrawingLockMode={isDrawingLockMode}
                lineColor={lineColor}
                lineType={lineType}
                showLabel={showLabel}
                lineOrientation={lineOrientation}
                setIsLineMode={setIsLineMode}
                setIsBoxMode={setIsBoxMode}
                setIsTrendMode={setIsTrendMode}
                setIsArrowMode={setIsArrowMode}
                setIsTextMode={setIsTextMode}
                boxOpacity={boxOpacity}
                arrowDirection={arrowDirection}
                arrowSize={arrowSize}
                arrowStyle={arrowStyle}
                annotationText={annotationText}
                fontSize={fontSize}
                textAnchor={textAnchor}
                setDataSeriesRef={setDataSeriesRef}
                setLastPriceLineRef={setLastPriceLineRef}
                setSciChartSurfaceRef={setSciChartSurfaceRef}
                livePrice={chartData[timeframes[1]][chartData[timeframes[1]].length - 1]}
                onAnnotationCreated={onAnnotationCreated}
                onAnnotationUpdated={onAnnotationUpdated}
                onAnnotationDeleted={onAnnotationDeleted}
                generateAnnotationId={(type) => createAnnotationId(type, timeframes[1])}
                onCrosshairMove={(timeframe, timestamp, price) => handleCrosshairMove(timeframe, timestamp, price)}
                isLiveMode={isLiveMode}
                isReplayMode={isReplayMode}
              />
            </div>
            <div
              className="vertical-divider"
              style={{ width: `${dividerWidth}px`, cursor: 'ew-resize' }}
              onMouseDown={handleMouseDown('vertical', 1)}
            />
            <div style={{ width: `${rightWidth}px`, position: 'relative', overflow: 'hidden' }}>
              <div style={{
                position: 'absolute',
                top: 5,
                left: 5,
                padding: '3px 8px',
                backgroundColor: '#000',
                color: '#fff',
                fontWeight: 'bold',
                zIndex: 50,
                borderRadius: '4px',
                fontSize: '14px',
              }}>
                {instrument} {timeframes[2]}
              </div>
              <ChartPane
                instrument={instrument}
                timeframe={timeframes[2]}
                candleData={chartData[timeframes[2]]}
                chartBehavior={settings.chartBehavior[timeframes[2]]}
                colors={settings.colors}
                gridOptions={settings.gridOptions}
                candleWidth={settings.candleWidth}
                chartType={settings.chartTypes ? settings.chartTypes[timeframes[2]] : 'Candle'}
                isCrosshairMode={isCrosshairMode}
                isLineMode={isLineMode}
                isBoxMode={isBoxMode}
                isTrendMode={isTrendMode}
                isArrowMode={isArrowMode}
                isTextMode={isTextMode}
                isDrawingLockMode={isDrawingLockMode}
                lineColor={lineColor}
                lineType={lineType}
                showLabel={showLabel}
                lineOrientation={lineOrientation}
                setIsLineMode={setIsLineMode}
                setIsBoxMode={setIsBoxMode}
                setIsTrendMode={setIsTrendMode}
                setIsArrowMode={setIsArrowMode}
                setIsTextMode={setIsTextMode}
                boxOpacity={boxOpacity}
                arrowDirection={arrowDirection}
                arrowSize={arrowSize}
                arrowStyle={arrowStyle}
                annotationText={annotationText}
                fontSize={fontSize}
                textAnchor={textAnchor}
                setDataSeriesRef={setDataSeriesRef}
                setLastPriceLineRef={setLastPriceLineRef}
                setSciChartSurfaceRef={setSciChartSurfaceRef}
                livePrice={chartData[timeframes[2]][chartData[timeframes[2]].length - 1]}
                onAnnotationCreated={onAnnotationCreated}
                onAnnotationUpdated={onAnnotationUpdated}
                onAnnotationDeleted={onAnnotationDeleted}
                generateAnnotationId={(type) => createAnnotationId(type, timeframes[2])}
                onCrosshairMove={(timeframe, timestamp, price) => handleCrosshairMove(timeframe, timestamp, price)}
                isLiveMode={isLiveMode}
                isReplayMode={isReplayMode}
              />
            </div>
          </>
        )}
      </div>
      <div
        className="horizontal-divider"
        style={{ height: `${dividerHeight}px`, cursor: 'ns-resize' }}
        onMouseDown={handleMouseDown('horizontal')}
      />
      <div style={{ display: 'flex', height: `${bottomHeight}px` }}>
        {chartLayout === '4-way' ? (
          // 4-way layout - bottom row (2 charts)
          <>
            <div style={{ width: `${leftWidth}px`, position: 'relative' }}>
              <div style={{
                position: 'absolute',
                top: 5,
                left: 5,
                padding: '3px 8px',
                backgroundColor: '#000',
                color: '#fff',
                fontWeight: 'bold',
                zIndex: 50,
                borderRadius: '4px',
                fontSize: '14px',
              }}>
                {instrument} {timeframes[2]}
              </div>
              <ChartPane
                instrument={instrument}
                timeframe={timeframes[2]}
                candleData={chartData[timeframes[2]]}
                chartBehavior={settings.chartBehavior[timeframes[2]]}
                colors={settings.colors}
                gridOptions={settings.gridOptions}
                candleWidth={settings.candleWidth}
                chartType={settings.chartTypes ? settings.chartTypes[timeframes[2]] : 'Candle'}
                isCrosshairMode={isCrosshairMode}
                isLineMode={isLineMode}
                isBoxMode={isBoxMode}
                isTrendMode={isTrendMode}
                isArrowMode={isArrowMode}
                isTextMode={isTextMode}
                isDrawingLockMode={isDrawingLockMode}
                lineColor={lineColor}
                lineType={lineType}
                showLabel={showLabel}
                lineOrientation={lineOrientation}
                setIsLineMode={setIsLineMode}
                setIsBoxMode={setIsBoxMode}
                setIsTrendMode={setIsTrendMode}
                setIsArrowMode={setIsArrowMode}
                setIsTextMode={setIsTextMode}
                boxOpacity={boxOpacity}
                arrowDirection={arrowDirection}
                arrowSize={arrowSize}
                arrowStyle={arrowStyle}
                annotationText={annotationText}
                fontSize={fontSize}
                textAnchor={textAnchor}
                setDataSeriesRef={setDataSeriesRef}
                setLastPriceLineRef={setLastPriceLineRef}
                setSciChartSurfaceRef={setSciChartSurfaceRef}
                livePrice={chartData[timeframes[2]][chartData[timeframes[2]].length - 1]}
                onAnnotationCreated={onAnnotationCreated}
                onAnnotationUpdated={onAnnotationUpdated}
                onAnnotationDeleted={onAnnotationDeleted}
                generateAnnotationId={(type) => createAnnotationId(type, timeframes[2])}
                onCrosshairMove={(timeframe, timestamp, price) => handleCrosshairMove(timeframe, timestamp, price)}
                isLiveMode={isLiveMode}
                isReplayMode={isReplayMode}
              />
            </div>
            <div
              className="vertical-divider"
              style={{ width: `${dividerWidth}px`, cursor: 'ew-resize' }}
              onMouseDown={handleMouseDown('vertical')}
            />
            <div style={{ width: `${rightWidth}px`, position: 'relative', overflow: 'hidden' }}>
              <div style={{
                position: 'absolute',
                top: 5,
                left: 5,
                padding: '3px 8px',
                backgroundColor: '#000',
                color: '#fff',
                fontWeight: 'bold',
                zIndex: 50,
                borderRadius: '4px',
                fontSize: '14px',
              }}>
                {instrument} {timeframes[3]}
              </div>
              <ChartPane
                instrument={instrument}
                timeframe={timeframes[3]}
                candleData={chartData[timeframes[3]]}
                chartBehavior={settings.chartBehavior[timeframes[3]]}
                colors={settings.colors}
                gridOptions={settings.gridOptions}
                candleWidth={settings.candleWidth}
                chartType={settings.chartTypes ? settings.chartTypes[timeframes[3]] : 'Candle'}
                isCrosshairMode={isCrosshairMode}
                isLineMode={isLineMode}
                isBoxMode={isBoxMode}
                isTrendMode={isTrendMode}
                isArrowMode={isArrowMode}
                isTextMode={isTextMode}
                isDrawingLockMode={isDrawingLockMode}
                lineColor={lineColor}
                lineType={lineType}
                showLabel={showLabel}
                lineOrientation={lineOrientation}
                setIsLineMode={setIsLineMode}
                setIsBoxMode={setIsBoxMode}
                setIsTrendMode={setIsTrendMode}
                setIsArrowMode={setIsArrowMode}
                setIsTextMode={setIsTextMode}
                boxOpacity={boxOpacity}
                arrowDirection={arrowDirection}
                arrowSize={arrowSize}
                arrowStyle={arrowStyle}
                annotationText={annotationText}
                fontSize={fontSize}
                textAnchor={textAnchor}
                setDataSeriesRef={setDataSeriesRef}
                setLastPriceLineRef={setLastPriceLineRef}
                setSciChartSurfaceRef={setSciChartSurfaceRef}
                livePrice={chartData[timeframes[3]][chartData[timeframes[3]].length - 1]}
                onAnnotationCreated={onAnnotationCreated}
                onAnnotationUpdated={onAnnotationUpdated}
                onAnnotationDeleted={onAnnotationDeleted}
                generateAnnotationId={(type) => createAnnotationId(type, timeframes[3])}
                onCrosshairMove={(timeframe, timestamp, price) => handleCrosshairMove(timeframe, timestamp, price)}
                isLiveMode={isLiveMode}
                isReplayMode={isReplayMode}
              />
            </div>
          </>
        ) : (
          // 6-way layout - bottom row (3 charts)
          <>
            <div style={{ width: `${leftWidth}px`, position: 'relative' }}>
              <div style={{
                position: 'absolute',
                top: 5,
                left: 5,
                padding: '3px 8px',
                backgroundColor: '#000',
                color: '#fff',
                fontWeight: 'bold',
                zIndex: 50,
                borderRadius: '4px',
                fontSize: '14px',
              }}>
                {instrument} {timeframes[3]}
              </div>
              <ChartPane
                instrument={instrument}
                timeframe={timeframes[3]}
                candleData={chartData[timeframes[3]]}
                chartBehavior={settings.chartBehavior[timeframes[3]]}
                colors={settings.colors}
                gridOptions={settings.gridOptions}
                candleWidth={settings.candleWidth}
                chartType={settings.chartTypes ? settings.chartTypes[timeframes[3]] : 'Candle'}
                isCrosshairMode={isCrosshairMode}
                isLineMode={isLineMode}
                isBoxMode={isBoxMode}
                isTrendMode={isTrendMode}
                isArrowMode={isArrowMode}
                isTextMode={isTextMode}
                isDrawingLockMode={isDrawingLockMode}
                lineColor={lineColor}
                lineType={lineType}
                showLabel={showLabel}
                lineOrientation={lineOrientation}
                setIsLineMode={setIsLineMode}
                setIsBoxMode={setIsBoxMode}
                setIsTrendMode={setIsTrendMode}
                setIsArrowMode={setIsArrowMode}
                setIsTextMode={setIsTextMode}
                boxOpacity={boxOpacity}
                arrowDirection={arrowDirection}
                arrowSize={arrowSize}
                arrowStyle={arrowStyle}
                annotationText={annotationText}
                fontSize={fontSize}
                textAnchor={textAnchor}
                setDataSeriesRef={setDataSeriesRef}
                setLastPriceLineRef={setLastPriceLineRef}
                setSciChartSurfaceRef={setSciChartSurfaceRef}
                livePrice={chartData[timeframes[3]][chartData[timeframes[3]].length - 1]}
                onAnnotationCreated={onAnnotationCreated}
                onAnnotationUpdated={onAnnotationUpdated}
                onAnnotationDeleted={onAnnotationDeleted}
                generateAnnotationId={(type) => createAnnotationId(type, timeframes[3])}
                onCrosshairMove={(timeframe, timestamp, price) => handleCrosshairMove(timeframe, timestamp, price)}
                isLiveMode={isLiveMode}
                isReplayMode={isReplayMode}
              />
            </div>
            <div
              className="vertical-divider"
              style={{ width: `${dividerWidth}px`, cursor: 'ew-resize' }}
              onMouseDown={handleMouseDown('vertical', 0)}
            />
            <div style={{ width: `${centerWidth}px`, position: 'relative' }}>
              <div style={{
                position: 'absolute',
                top: 5,
                left: 5,
                padding: '3px 8px',
                backgroundColor: '#000',
                color: '#fff',
                fontWeight: 'bold',
                zIndex: 50,
                borderRadius: '4px',
                fontSize: '14px',
              }}>
                {instrument} {timeframes[4]}
              </div>
              <ChartPane
                instrument={instrument}
                timeframe={timeframes[4]}
                candleData={chartData[timeframes[4]]}
                chartBehavior={settings.chartBehavior[timeframes[4]]}
                colors={settings.colors}
                gridOptions={settings.gridOptions}
                candleWidth={settings.candleWidth}
                chartType={settings.chartTypes ? settings.chartTypes[timeframes[4]] : 'Candle'}
                isCrosshairMode={isCrosshairMode}
                isLineMode={isLineMode}
                isBoxMode={isBoxMode}
                isTrendMode={isTrendMode}
                isArrowMode={isArrowMode}
                isTextMode={isTextMode}
                isDrawingLockMode={isDrawingLockMode}
                lineColor={lineColor}
                lineType={lineType}
                showLabel={showLabel}
                lineOrientation={lineOrientation}
                setIsLineMode={setIsLineMode}
                setIsBoxMode={setIsBoxMode}
                setIsTrendMode={setIsTrendMode}
                setIsArrowMode={setIsArrowMode}
                setIsTextMode={setIsTextMode}
                boxOpacity={boxOpacity}
                arrowDirection={arrowDirection}
                arrowSize={arrowSize}
                arrowStyle={arrowStyle}
                annotationText={annotationText}
                fontSize={fontSize}
                textAnchor={textAnchor}
                setDataSeriesRef={setDataSeriesRef}
                setLastPriceLineRef={setLastPriceLineRef}
                setSciChartSurfaceRef={setSciChartSurfaceRef}
                livePrice={chartData[timeframes[4]][chartData[timeframes[4]].length - 1]}
                onAnnotationCreated={onAnnotationCreated}
                onAnnotationUpdated={onAnnotationUpdated}
                onAnnotationDeleted={onAnnotationDeleted}
                generateAnnotationId={(type) => createAnnotationId(type, timeframes[4])}
                onCrosshairMove={(timeframe, timestamp, price) => handleCrosshairMove(timeframe, timestamp, price)}
                isLiveMode={isLiveMode}
                isReplayMode={isReplayMode}
              />
            </div>
            <div
              className="vertical-divider"
              style={{ width: `${dividerWidth}px`, cursor: 'ew-resize' }}
              onMouseDown={handleMouseDown('vertical', 1)}
            />
            <div style={{ width: `${rightWidth}px`, position: 'relative', overflow: 'hidden' }}>
              <div style={{
                position: 'absolute',
                top: 5,
                left: 5,
                padding: '3px 8px',
                backgroundColor: '#000',
                color: '#fff',
                fontWeight: 'bold',
                zIndex: 50,
                borderRadius: '4px',
                fontSize: '14px',
              }}>
                {instrument} {timeframes[5]}
              </div>
              <ChartPane
                instrument={instrument}
                timeframe={timeframes[5]}
                candleData={chartData[timeframes[5]]}
                chartBehavior={settings.chartBehavior[timeframes[5]]}
                colors={settings.colors}
                gridOptions={settings.gridOptions}
                candleWidth={settings.candleWidth}
                chartType={settings.chartTypes ? settings.chartTypes[timeframes[5]] : 'Candle'}
                isCrosshairMode={isCrosshairMode}
                isLineMode={isLineMode}
                isBoxMode={isBoxMode}
                isTrendMode={isTrendMode}
                isArrowMode={isArrowMode}
                isTextMode={isTextMode}
                isDrawingLockMode={isDrawingLockMode}
                lineColor={lineColor}
                lineType={lineType}
                showLabel={showLabel}
                lineOrientation={lineOrientation}
                setIsLineMode={setIsLineMode}
                setIsBoxMode={setIsBoxMode}
                setIsTrendMode={setIsTrendMode}
                setIsArrowMode={setIsArrowMode}
                setIsTextMode={setIsTextMode}
                boxOpacity={boxOpacity}
                arrowDirection={arrowDirection}
                arrowSize={arrowSize}
                arrowStyle={arrowStyle}
                annotationText={annotationText}
                fontSize={fontSize}
                textAnchor={textAnchor}
                setDataSeriesRef={setDataSeriesRef}
                setLastPriceLineRef={setLastPriceLineRef}
                setSciChartSurfaceRef={setSciChartSurfaceRef}
                livePrice={chartData[timeframes[5]][chartData[timeframes[5]].length - 1]}
                onAnnotationCreated={onAnnotationCreated}
                onAnnotationUpdated={onAnnotationUpdated}
                onAnnotationDeleted={onAnnotationDeleted}
                generateAnnotationId={(type) => createAnnotationId(type, timeframes[5])}
                onCrosshairMove={(timeframe, timestamp, price) => handleCrosshairMove(timeframe, timestamp, price)}
                isLiveMode={isLiveMode}
                isReplayMode={isReplayMode}
              />
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default ChartLayout; 