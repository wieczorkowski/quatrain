import styled from 'styled-components';
import { FaQuestionCircle } from 'react-icons/fa';

// Styled components for the Trade Window UI
export const TradeWindowContainer = styled.div`
  display: flex;
  height: 100vh;
  background-color: #1a1a1a;
  color: #ffffff;
  font-family: 'Arial', sans-serif;
  overflow: hidden;
  width: 100%;
`;

// Main content container to hold both panels side by side
export const MainContent = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
`;

// Left panel for original trade window content
export const TradingPanel = styled.div`
  width: 50%; /* Always 50% since we always show right panel now */
  display: flex;
  flex-direction: column;
  padding: 20px;
  transition: width 0.3s ease;
`;

// Right panel for Chart Trader
export const ChartTraderPanel = styled.div`
  width: 50%;
  display: flex;
  flex-direction: column;
  border-left: 1px solid #333;
  padding: 20px;
  overflow: auto;
`;

// Right panel for Smart Stop Management
export const SmartStopPanel = styled.div`
  width: 50%;
  display: flex;
  flex-direction: column;
  border-left: 1px solid #333;
  padding: 20px;
  overflow: auto;
`;

// Tabs container at the top of the right panel
export const TabsContainer = styled.div`
  display: flex;
  background-color: #222;
  border-bottom: 1px solid #333;
  position: absolute;
  top: 0;
  right: 0;
  width: 50%;
  z-index: 10;
`;

export const Tab = styled.div`
  padding: 12px 20px;
  cursor: pointer;
  font-size: 14px;
  font-weight: ${props => props.active ? 'bold' : 'normal'};
  color: ${props => props.active ? '#fff' : '#aaa'};
  background-color: ${props => props.active ? '#1a1a1a' : 'transparent'};
  border-bottom: 2px solid ${props => props.active ? '#007bff' : 'transparent'};
  transition: all 0.2s ease;

  &:hover {
    color: white;
    background-color: ${props => props.active ? '#1a1a1a' : '#2a2a2a'};
  }
`;

export const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0 10px 0;
  border-bottom: 1px solid #333;
  margin-bottom: 15px;
  width: 100%;
`;

export const HeaderLeft = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  flex: 1;
`;

export const HeaderTitle = styled.h1`
  font-size: 22px;
  margin: 0;
  color: #ffffff;
  font-weight: bold;
  line-height: 1.2;
`;

export const HeaderCenter = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
`;

export const HeaderSymbol = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
`;

export const SymbolText = styled.div`
  font-size: 16px;
  font-weight: bold;
  color: #4CAF50;
  line-height: 1.2;
  margin-bottom: 4px;
`;

export const PriceText = styled.div`
  font-size: 32px;
  font-weight: bold;
  color: #ffffff;
  line-height: 1;
`;

export const HeaderAccount = styled.div`
  font-size: 14px;
  color: ${props => props.isConnected ? '#4CAF50' : '#F44336'};
  text-align: right;
  flex: 1;
  font-family: 'Courier New', monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const Form = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 400px;
  margin: 0 auto;
  margin-bottom: 0;
`;

export const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

export const Label = styled.label`
  font-size: 14px;
  color: #aaa;
`;

export const Input = styled.input`
  width: 100%;
  background-color: #333;
  color: white;
  border: 1px solid #444;
  padding: 10px 15px;
  font-size: 14px;
  border-radius: 4px;
  outline: none;
  
  &:focus {
    border-color: #007bff;
  }
`;

export const ButtonGroup = styled.div`
  display: flex;
  gap: 15px;
  margin-top: 15px;
  align-items: center;
`;

export const Button = styled.button`
  flex: 1;
  background-color: ${props => props.color || '#444'};
  color: white;
  border: none;
  padding: 12px;
  font-size: 16px;
  font-weight: bold;
  border-radius: 4px;
  cursor: pointer;
  
  &:hover {
    filter: brightness(1.1);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

// Added small text style for sub-labels on buttons
export const SmallText = styled.span`
  display: block;
  font-size: 10px;
  font-weight: normal;
  color: #ccc;
  margin-top: 2px;
`;

export const QtyInput = styled.input`
  width: 70px;
  background-color: #333;
  color: white;
  border: 1px solid #444;
  padding: 10px;
  font-size: 14px;
  border-radius: 4px;
  outline: none;
  text-align: center;
  margin: 0 8px;
  
  &:focus {
    border-color: #007bff;
  }
`;

export const InfoBox = styled.div`
  background-color: #222;
  border-radius: 4px;
  border: 1px solid #333;
  padding: 15px;
  margin-bottom: 20px;
`;

export const InfoRow = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

export const InfoLabel = styled.span`
  color: #aaa;
`;

export const InfoValue = styled.span`
  font-weight: bold;
  font-family: 'Courier New', monospace;
`;

export const StatusMessage = styled.div`
  margin-top: 20px;
  padding: 10px;
  border-radius: 4px;
  text-align: center;
  background-color: ${props => 
    props.success ? 'rgba(76, 175, 80, 0.2)' : 
    props.error ? 'rgba(244, 67, 54, 0.2)' : 'transparent'};
  color: ${props => 
    props.success ? '#4CAF50' : 
    props.error ? '#F44336' : '#FFFFFF'};
  border: 1px solid ${props => 
    props.success ? '#4CAF50' : 
    props.error ? '#F44336' : 'transparent'};
  visibility: ${props => props.visible ? 'visible' : 'hidden'};
  margin-bottom: 15px;
`;

export const SectionTitle = styled.h3`
  font-size: 16px;
  color: #f0f0f0;
  margin-bottom: 15px;
  text-align: center;
`;

// Added Select styled component
export const Select = styled.select`
  width: 100%;
  background-color: #333;
  color: white;
  border: 1px solid #444;
  padding: 10px 15px;
  font-size: 14px;
  border-radius: 4px;
  outline: none;
  appearance: none; // Remove default arrow
  background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23BBB%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E');
  background-repeat: no-repeat;
  background-position: right 10px top 50%;
  background-size: .65em auto;

  &:focus {
    border-color: #007bff;
  }
`;

// Added Placeholder for unimplemented features
export const NotImplemented = styled.div`
  text-align: center;
  color: #aaa;
  margin-top: 20px;
  padding: 20px;
  border: 1px dashed #444;
  border-radius: 4px;
`;

export const LimitSubtypeGroup = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 15px; /* Add some space below */
`;

export const LimitPriceInput = styled(Input)`
  flex: 1; /* Allow input to take available space */
  width: auto; /* Override fixed width */
`;

export const LimitSubtypeSelect = styled(Select)`
  flex: 1; /* Allow select to take available space */
  width: auto; /* Override fixed width */
`;

// Added Stop Order specific styles (mirroring Limit)
export const StopSubtypeGroup = styled(LimitSubtypeGroup)``; // Reuse styling
export const StopPriceInput = styled(LimitPriceInput)``; // Reuse styling
export const StopSubtypeSelect = styled(LimitSubtypeSelect)``; // Reuse styling

// New styled components for Chart Trader
export const ChartTraderContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

export const ChartTraderHeader = styled.h2`
  font-size: 22px;
  color: #f0f0f0;
  margin-bottom: 8px;
  border-bottom: 1px solid #333;
  padding-bottom: 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

export const HeaderIcon = styled.img`
  height: 60px;
  width: auto;
  margin-left: 10px;
  opacity: 1.0;
`;

export const ChartTraderSection = styled.div`
  background-color: #222;
  border-radius: 4px;
  border: 1px solid #333;
  padding: 8px 10px;
  margin-bottom: 8px;
`;

export const ChartTraderSectionTitle = styled.h4`
  font-size: 14px;
  color: #f0f0f0;
  margin-bottom: 6px;
  text-align: left;
  border-bottom: 1px solid #444;
  padding-bottom: 4px;
`;

export const ChartTraderButtonGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 5px;
`;

export const ChartTraderButton = styled(Button)`
  flex: 1;
  padding: 6px;
  font-size: 13px;
`;

export const CompactQtyInput = styled(QtyInput)`
  width: 45px;
  padding: 6px;
  font-size: 13px;
  margin: 0;
`;

export const CheckboxContainer = styled.div`
  display: flex;
  align-items: center;
  margin-top: 4px;
  margin-bottom: 4px;
`;

export const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  font-size: 12px;
  color: #aaa;
  cursor: pointer;
`;

export const Checkbox = styled.input`
  margin-right: 4px;
  cursor: pointer;
`;

export const PositionActionGroup = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 15px;
  align-items: center;
`;

// New styled components for Smart Stop Management
export const SmartStopContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

export const SmartStopHeader = styled.h2`
  font-size: 22px;
  color: #f0f0f0;
  margin-bottom: 8px;
  border-bottom: 1px solid #333;
  padding-bottom: 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

export const SmartStopSection = styled.div`
  background-color: #222;
  border-radius: 4px;
  border: 1px solid #333;
  padding: 8px 10px;
  margin-bottom: 8px;
`;

// Modified SmartStopSectionTitle with reduced top margin
export const SmartStopSectionTitle = styled.h4`
  font-size: 14px;
  color: #f0f0f0;
  margin-top: 2px; /* Reduced from default */
  margin-bottom: 6px;
  text-align: left;
  border-bottom: 1px solid #444;
  padding-bottom: 4px;
`;

// Added tooltip wrapper and styles
export const TooltipWrapper = styled.div`
  position: relative;
  display: inline-flex;
  align-items: center;
  margin-left: 5px;
  cursor: help;
  
  &:hover .tooltip-content {
    visibility: visible;
    opacity: 1;
  }
`;

export const TooltipIcon = styled.div`
  color: #777;
  display: flex;
  align-items: center;
`;

export const TooltipContent = styled.div`
  visibility: hidden;
  opacity: 0;
  position: absolute;
  z-index: 1000;
  bottom: 125%;
  left: 50%;
  transform: translateX(-50%);
  background-color: #333;
  color: #ddd;
  text-align: center;
  border-radius: 4px;
  padding: 8px 12px;
  width: max-content;
  max-width: 200px;
  font-size: 11px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  border: 1px solid #444;
  transition: opacity 0.3s;
  
  &::after {
    content: "";
    position: absolute;
    top: 100%;
    left: 50%;
    margin-left: -5px;
    border-width: 5px;
    border-style: solid;
    border-color: #333 transparent transparent transparent;
  }
`;

// Tooltip component
export const Tooltip = ({ text }) => (
  <TooltipWrapper>
    <TooltipIcon>
      <FaQuestionCircle size={14} />
    </TooltipIcon>
    <TooltipContent className="tooltip-content">{text}</TooltipContent>
  </TooltipWrapper>
); 