import { alpha, createTheme } from '@mui/material/styles'

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#455f88',
      light: '#d6e3ff',
      dark: '#39537c',
    },
    secondary: {
      main: '#546073',
      light: '#d8e3fa',
      dark: '#495467',
    },
    background: {
      default: '#f7fafc',
      paper: '#ffffff',
    },
    text: {
      primary: '#283439',
      secondary: '#546166',
    },
    success: {
      main: '#1a61a4',
    },
    warning: {
      main: '#67a1e8',
    },
    error: {
      main: '#9f403d',
    },
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
          background: '#f7fafc',
        },
        '#root': {
          minHeight: '100vh',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: alpha('#ffffff', 0.98),
          boxShadow: 'none',
          borderBottom: '1px solid rgba(167, 180, 186, 0.2)',
          color: '#283439',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          background: '#f8fafc',
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
          border: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
          boxShadow: '0 6px 18px rgba(40, 52, 57, 0.06)',
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
          backgroundColor: '#eff4f7',
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
