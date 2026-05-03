import { alpha, createTheme } from '@mui/material/styles'

const palettes = {
  light: {
    primary: { main: '#455f88', light: '#d6e3ff', dark: '#39537c', contrastText: '#ffffff' },
    secondary: { main: '#546073', light: '#d8e3fa', dark: '#495467', contrastText: '#ffffff' },
    background: { default: '#f7fafc', paper: '#ffffff' },
    text: { primary: '#283439', secondary: '#546166' },
    appBarBg: '#ffffff',
    appBarBorder: 'rgba(167, 180, 186, 0.2)',
    appBarText: '#283439',
    drawerBg: '#f8fafc',
    cardShadow: '0 6px 18px rgba(40, 52, 57, 0.06)',
    cardBorderAlpha: 0.08,
    inputBg: '#eff4f7',
    disabledBg: '#c8d1dc',
    disabledText: '#6c7682',
    disabledBorder: '#b3bcc7',
  },
  dark: {
    primary: { main: '#9bb6e2', light: '#d6e3ff', dark: '#455f88', contrastText: '#ffffff' },
    secondary: { main: '#a8b8cf', light: '#d8e3fa', dark: '#546073', contrastText: '#ffffff' },
    background: { default: '#0f172a', paper: '#152033' },
    text: { primary: '#e2e8f0', secondary: '#94a3b8' },
    appBarBg: '#152033',
    appBarBorder: 'rgba(148, 163, 184, 0.18)',
    appBarText: '#e2e8f0',
    drawerBg: '#0d1623',
    cardShadow: '0 6px 18px rgba(0, 0, 0, 0.45)',
    cardBorderAlpha: 0.18,
    inputBg: 'rgba(148, 163, 184, 0.08)',
    disabledBg: '#3a4661',
    disabledText: '#8b95a8',
    disabledBorder: '#4a5573',
  },
}

export function buildTheme(mode = 'light') {
  const tokens = palettes[mode] || palettes.light

  return createTheme({
    palette: {
      mode,
      primary: tokens.primary,
      secondary: tokens.secondary,
      background: tokens.background,
      text: tokens.text,
      success: { main: '#1a61a4' },
      warning: { main: '#67a1e8' },
      error: { main: '#9f403d' },
    },
    shape: {
      borderRadius: 12,
    },
    typography: {
      fontFamily: ['Inter', 'sans-serif'].join(','),
      h3: {
        fontWeight: 800,
        letterSpacing: '-0.03em',
        fontFamily: ['Manrope', 'sans-serif'].join(','),
      },
      h4: {
        fontWeight: 800,
        letterSpacing: '-0.03em',
        fontFamily: ['Manrope', 'sans-serif'].join(','),
      },
      h5: {
        fontWeight: 800,
        letterSpacing: '-0.02em',
        fontFamily: ['Manrope', 'sans-serif'].join(','),
      },
      h6: {
        fontWeight: 700,
        letterSpacing: '-0.01em',
        fontFamily: ['Manrope', 'sans-serif'].join(','),
      },
      subtitle1: {
        fontWeight: 600,
      },
      button: {
        textTransform: 'none',
        fontWeight: 700,
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            background: tokens.background.default,
          },
          '#root': {
            minHeight: '100vh',
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            background: alpha(tokens.appBarBg, 0.98),
            boxShadow: 'none',
            borderBottom: `1px solid ${tokens.appBarBorder}`,
            color: tokens.appBarText,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            background: tokens.drawerBg,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: ({ theme }) => ({
            border: `1px solid ${alpha(theme.palette.primary.main, tokens.cardBorderAlpha)}`,
            boxShadow: tokens.cardShadow,
            borderRadius: theme.shape.borderRadius,
          }),
        },
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true,
        },
        styleOverrides: {
          root: {
            borderRadius: 8,
            paddingInline: 18,
            '&.Mui-disabled': {
              backgroundImage: 'none',
              backgroundColor: tokens.disabledBg,
              color: tokens.disabledText,
              border: `1px solid ${tokens.disabledBorder}`,
              cursor: 'not-allowed',
              pointerEvents: 'auto',
              opacity: 0.85,
              boxShadow: 'none',
            },
          },
          containedPrimary: {
            backgroundImage: 'linear-gradient(135deg, #455f88 0%, #39537c 100%)',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 999,
            fontWeight: 600,
          },
        },
      },
      MuiTextField: {
        defaultProps: {
          variant: 'outlined',
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            backgroundColor: tokens.inputBg,
          },
          notchedOutline: {
            borderColor: 'transparent',
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 14,
          },
        },
      },
    },
  })
}

export const theme = buildTheme('light')
