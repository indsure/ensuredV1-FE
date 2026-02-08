import { useState, useCallback } from "react"

export interface ValidationRule {
  required?: boolean
  minLength?: number
  maxLength?: number
  pattern?: RegExp
  custom?: (value: any) => string | undefined
}

export interface ValidationRules {
  [key: string]: ValidationRule
}

export interface FormErrors {
  [key: string]: string | undefined
}

export function useFormValidation<T extends Record<string, any>>(
  initialValues: T,
  rules: ValidationRules
) {
  const [values, setValues] = useState<T>(initialValues)
  const [errors, setErrors] = useState<FormErrors>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const validateField = useCallback(
    (name: string, value: any): string | undefined => {
      const rule = rules[name]
      if (!rule) return undefined

      // Required check
      if (rule.required && (!value || (typeof value === "string" && value.trim() === ""))) {
        return "This field is required"
      }

      // Skip other validations if field is empty and not required
      if (!value && !rule.required) return undefined

      // Min length
      if (rule.minLength && typeof value === "string" && value.length < rule.minLength) {
        return `Must be at least ${rule.minLength} characters`
      }

      // Max length
      if (rule.maxLength && typeof value === "string" && value.length > rule.maxLength) {
        return `Must be no more than ${rule.maxLength} characters`
      }

      // Pattern
      if (rule.pattern && typeof value === "string" && !rule.pattern.test(value)) {
        return "Invalid format"
      }

      // Custom validation
      if (rule.custom) {
        return rule.custom(value)
      }

      return undefined
    },
    [rules]
  )

  const validateAll = useCallback((): boolean => {
    const newErrors: FormErrors = {}
    let isValid = true

    Object.keys(rules).forEach((key) => {
      const error = validateField(key, values[key])
      if (error) {
        newErrors[key] = error
        isValid = false
      }
    })

    setErrors(newErrors)
    return isValid
  }, [values, rules, validateField])

  const handleChange = useCallback(
    (name: string, value: any) => {
      setValues((prev) => ({ ...prev, [name]: value }))

      // Clear error when user starts typing
      if (errors[name]) {
        setErrors((prev) => ({ ...prev, [name]: undefined }))
      }
    },
    [errors]
  )

  const handleBlur = useCallback(
    (name: string) => {
      setTouched((prev) => ({ ...prev, [name]: true }))
      const error = validateField(name, values[name])
      setErrors((prev) => ({ ...prev, [name]: error }))
    },
    [values, validateField]
  )

  const setError = useCallback((name: string, error: string | undefined) => {
    setErrors((prev) => ({ ...prev, [name]: error }))
  }, [])

  const reset = useCallback(() => {
    setValues(initialValues)
    setErrors({})
    setTouched({})
  }, [initialValues])

  const isFieldValid = useCallback(
    (name: string): boolean => {
      return !errors[name] && touched[name]
    },
    [errors, touched]
  )

  const isFormValid = useCallback((): boolean => {
    return Object.keys(rules).every((key) => {
      const error = validateField(key, values[key])
      return !error
    })
  }, [values, rules, validateField])

  return {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    validateAll,
    setError,
    reset,
    isFieldValid,
    isFormValid,
    setValues,
  }
}

