/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ===== 主色调系统 =====
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
        // ===== 强调色系统 =====
        accent: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7e22ce',
          800: '#6b21a8',
          900: '#581c87',
          950: '#3b0764',
        },
        // ===== 状态色系统 =====
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          950: '#451a03',
        },
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
          950: '#450a0a',
        },
        info: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
        // ===== 中性色系统 =====
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        // ===== 平台色系扩展 =====
        platform: {
          // 侧边栏背景
          sidebar: '#0f172a',
          sidebarLight: '#1e293b',
          sidebarHover: '#334155',
          
          // 主内容区背景
          content: '#f8fafc',
          contentDark: '#1e293b',
          
          // 卡片背景
          card: '#ffffff',
          cardDark: '#1e293b',
          
          // 文字颜色
          textPrimary: '#0f172a',
          textSecondary: '#475569',
          textTertiary: '#94a3b8',
          textPrimaryDark: '#f8fafc',
          textSecondaryDark: '#cbd5e1',
          textTertiaryDark: '#64748b',
          
          // 边框颜色
          border: '#e2e8f0',
          borderDark: '#334155',
          
          // 阴影颜色
          shadow: 'rgba(0, 0, 0, 0.1)',
          shadowDark: 'rgba(0, 0, 0, 0.3)',
        },
        // ===== 渐变色配色 =====
        gradient: {
          primary: '#0ea5e9',
          secondary: '#a855f7',
          tertiary: '#06b6d4',
          accent: '#ec4899',
        }
      },
      fontFamily: {
        inter: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
        '6xl': ['3.75rem', { lineHeight: '1' }],
      },
      spacing: {
        18: '4.5rem',
        88: '22rem',
        96: '24rem',
        128: '32rem',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        // 柔和阴影
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        // 卡片阴影
        'card': '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 30px -5px rgba(0, 0, 0, 0.04)',
        // 提升阴影
        'elevated': '0 20px 40px -5px rgba(0, 0, 0, 0.15), 0 10px 20px -5px rgba(0, 0, 0, 0.04)',
        // 发光效果
        'glow': '0 0 40px -5px rgba(14, 165, 233, 0.3)',
        'glow-primary': '0 0 40px -5px rgba(14, 165, 233, 0.4)',
        'glow-accent': '0 0 40px -5px rgba(168, 85, 247, 0.4)',
        'glow-success': '0 0 40px -5px rgba(34, 197, 94, 0.4)',
        'glow-warning': '0 0 40px -5px rgba(245, 158, 11, 0.4)',
        'glow-danger': '0 0 40px -5px rgba(239, 68, 68, 0.4)',
        // 深色模式阴影
        'dark-soft': '0 2px 15px -3px rgba(0, 0, 0, 0.3), 0 10px 20px -2px rgba(0, 0, 0, 0.2)',
        'dark-card': '0 4px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 30px -5px rgba(0, 0, 0, 0.3)',
        'dark-elevated': '0 20px 40px -5px rgba(0, 0, 0, 0.5), 0 10px 20px -5px rgba(0, 0, 0, 0.4)',
        // 内阴影
        'inner': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)',
        'inner-lg': 'inset 0 4px 6px -1px rgba(0, 0, 0, 0.1), inset 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      },
      animation: {
        // 淡入动画
        'fade-in': 'fadeIn 0.3s ease-out',
        'fade-in-up': 'fadeInUp 0.4s ease-out',
        'fade-in-down': 'fadeInDown 0.4s ease-out',
        'fade-in-left': 'fadeInLeft 0.3s ease-out',
        'fade-in-right': 'fadeInRight 0.3s ease-out',
        // 滑入动画
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-down': 'slideDown 0.4s ease-out',
        'slide-left': 'slideLeft 0.3s ease-out',
        'slide-right': 'slideRight 0.3s ease-out',
        // 弹入动画
        'bounce-in': 'bounceIn 0.5s ease-out',
        'bounce-in-up': 'bounceInUp 0.6s ease-out',
        'bounce-in-down': 'bounceInDown 0.6s ease-out',
        // 缩放动画
        'scale-in': 'scaleIn 0.3s ease-out',
        'scale-in-sm': 'scaleInSm 0.2s ease-out',
        // 脉冲动画
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        // 闪烁动画
        'shimmer': 'shimmer 2s linear infinite',
        // 浮动动画
        'float': 'float 3s ease-in-out infinite',
        'float-slow': 'floatSlow 4s ease-in-out infinite',
        // 旋转动画
        'spin-slow': 'spin 3s linear infinite',
        'spin-reverse': 'spinReverse 3s linear infinite',
        // 摇摆动画
        'swing': 'swing 2s ease-in-out infinite',
        // 计数动画
        'count-up': 'countUp 0.5s ease-out',
        // 边框流动
        'border-flow': 'borderFlow 3s linear infinite',
        // 波纹动画
        'ripple': 'ripple 0.6s ease-out',
        // 摇晃动画
        'shake': 'shake 0.5s ease-in-out',
        // 心跳动画
        'heartbeat': 'heartbeat 1.5s ease-in-out infinite',
        // 打字机效果
        'typing': 'typing 2s steps(20) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInDown: {
          '0%': { opacity: '0', transform: 'translateY(-20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        fadeInRight: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideLeft: {
          '0%': { opacity: '0', transform: 'translateX(30px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideRight: {
          '0%': { opacity: '0', transform: 'translateX(-30px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        bounceIn: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '50%': { transform: 'scale(1.05)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        bounceInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px) scale(0.95)' },
          '50%': { transform: 'translateY(-5px) scale(1.02)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        bounceInDown: {
          '0%': { opacity: '0', transform: 'translateY(-20px) scale(0.95)' },
          '50%': { transform: 'translateY(5px) scale(1.02)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.8)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        scaleInSm: {
          '0%': { transform: 'scale(0.95)' },
          '100%': { transform: 'scale(1)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(14, 165, 233, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(14, 165, 233, 0.6)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        floatSlow: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-15px)' },
        },
        spinReverse: {
          'from': { transform: 'rotate(360deg)' },
          'to': { transform: 'rotate(0deg)' },
        },
        swing: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
        countUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        borderFlow: {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        ripple: {
          '0%': { transform: 'scale(0)', opacity: '1' },
          '100%': { transform: 'scale(4)', opacity: '0' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-5px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(5px)' },
        },
        heartbeat: {
          '0%, 100%': { transform: 'scale(1)' },
          '14%': { transform: 'scale(1.1)' },
          '28%': { transform: 'scale(1)' },
          '42%': { transform: 'scale(1.1)' },
          '70%': { transform: 'scale(1)' },
        },
        typing: {
          '0%': { width: '0' },
          '100%': { width: '100%' },
        },
      },
      backgroundImage: {
        // 主渐变
        'gradient-primary': 'linear-gradient(135deg, #0ea5e9 0%, #a855f7 50%, #06b6d4 100%)',
        'gradient-secondary': 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
        'gradient-success': 'linear-gradient(135deg, #22c55e 0%, #10b981 100%)',
        'gradient-warning': 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        'gradient-danger': 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
        // 侧边栏渐变
        'gradient-sidebar': 'linear-gradient(180deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        'gradient-sidebar-light': 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
        // 卡片渐变
        'gradient-card': 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
        'gradient-card-dark': 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)',
        // 悬停渐变
        'gradient-hover': 'linear-gradient(135deg, rgba(14, 165, 233, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)',
        // 玻璃效果
        'glass-dark': 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)',
        'glass-light': 'linear-gradient(135deg, rgba(255, 255, 255, 0.7) 0%, rgba(248, 250, 252, 0.8) 100%)',
        // 登录页面渐变
        'gradient-login': 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
        'gradient-login-light': 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #faf5ff 100%)',
      },
      backdropBlur: {
        xs: '2px',
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '24px',
        '3xl': '32px',
      },
      transitionProperty: {
        'height': 'height',
        'spacing': 'margin, padding',
        'transform': 'transform',
        'all': 'all',
      },
      transitionDuration: {
        '150': '150ms',
        '200': '200ms',
        '250': '250ms',
        '300': '300ms',
        '400': '400ms',
        '500': '500ms',
        '700': '700ms',
        '1000': '1000ms',
      },
      transitionTimingFunction: {
        'ease-out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'ease-in-expo': 'cubic-bezier(0.6, 0, 1, 1)',
        'ease-in-out-expo': 'cubic-bezier(0.87, 0, 0.13, 1)',
      },
    },
  },
  plugins: [],
}
