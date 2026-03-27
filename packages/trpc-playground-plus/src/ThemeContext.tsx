import { createContext, useContext } from 'react';
import { ThemeConfig, getTheme } from './theme';

const ThemeContext = createContext<ThemeConfig>(getTheme('dark'));

export const ThemeProvider = ThemeContext.Provider;
export const useTheme = () => useContext(ThemeContext);
