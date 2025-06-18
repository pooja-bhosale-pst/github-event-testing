import "react-querybuilder/dist/query-builder.css"

import {
  ActionIcon,
  Group,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  useMantineColorScheme,
} from "@mantine/core"
import { useDebouncedCallback } from "@mantine/hooks"
import { QueryBuilderMantine } from "@react-querybuilder/mantine"
import { IconXboxXFilled } from "@tabler/icons-react"
import _ from "lodash"
import { useCallback, useMemo, useState } from "react"
import { MultiSelect } from "react-multi-select-component"
import {
  QueryBuilder as BaseQueryBuilder,
  FieldSelectorProps,
  isOptionGroupArray,
  OperatorSelectorProps,
  RuleGroupType,
  useValueSelector,
  ValueEditorProps,
} from "react-querybuilder"

import { queryValidator } from "@costory/shared/utils/reactQueryBuilder"

import { QueryWrapper } from "@costory/front/components/layout/QueryWrapper"
import { OptionItemRenderer } from "@costory/front/components/multiSelect/OptionItemRenderer"
import { SelectedValueRenderer } from "@costory/front/components/multiSelect/SelectedValueRenderer"
import { useAxesQuery } from "@costory/front/queries/axes"
import { DatasourceType, orderDatasources } from "@costory/front/utils/filters"

import CELQueryBuilder from "./queryBuilder/CELQueryBuilder"
import type { QueryBuilderPickerType } from "./queryBuilder/QueryBuilderPicker"
import QueryBuilderPicker from "./queryBuilder/QueryBuilderPicker"

type Props = {
  value?: RuleGroupType
  defaultValue?: RuleGroupType
  onChange: (query: RuleGroupType | null) => void
  queryError?: boolean
}
export type optionType = { value: string; label: string }

const CustomOperatorSelector = (props: OperatorSelectorProps) => {
  const options = useMemo(() => {
    // It supposedly won't happen but we want to make Typescript happy
    const flatOptions = isOptionGroupArray(props.options)
      ? props.options.flatMap((og) => og.options)
      : props.options
    return flatOptions.map((option) => ({
      value: option.name,
      label: option.label,
    }))
  }, [props.options])

  return (
    <Select
      w={182} // So it align properly with the line above
      data={options}
      allowDeselect={false}
      value={props.value}
      onChange={props.handleOnChange}
    />
  )
}

const CustomFieldSelector = (props: FieldSelectorProps) => {
  const options = useMemo(() => {
    // It supposedly won't happen but we want to make Typescript happy
    const flatOptions = isOptionGroupArray(props.options)
      ? props.options.flatMap((og) => og.options)
      : props.options
    return _.sortBy(
      _.map(
        _.groupBy(flatOptions, (o) => o.groupTitle),
        (groupOptions, group) => ({
          group,
          items: groupOptions.map((option) => ({
            value: option.value,
            label: option.label,
          })),
        }),
      ),
      (option) => orderDatasources(option.group as DatasourceType),
    )
  }, [props.options])

  return (
    <Select
      searchable
      allowDeselect={false}
      value={props.value}
      onChange={props.handleOnChange}
      data={options}
      // 414 px so the dropdown aligns properly with operator selector
      comboboxProps={{ width: 394, position: "bottom-start", zIndex: 1000 }}
    />
  )
}

const CustomValueEditor = (props: ValueEditorProps) => {
  const [value, setValue] = useState<string>(props.value)
  const onChangeDebounced = useDebouncedCallback(
    (val) => props.handleOnChange(val),
    600,
  )
  const { colorScheme } = useMantineColorScheme()
  const { onChange, val } = useValueSelector({
    handleOnChange: props.handleOnChange,
    listsAsArrays: true,
    multiple: true,
    value: props.value,
  })

  if (!_.isBoolean(props.validation)) {
    const isDisabled = ["null", "notNull"].includes(props.operator)
    const options =
      props.values?.map(({ name, label }) => ({
        value: name,
        label,
      })) ?? []
    const values = !isDisabled
      ? _.map(val, (item) => ({ value: item, label: item }))
      : []
    const optionsWithActualValues = _.uniqBy(
      options.concat(values),
      (a) => a.value,
    )
    if (!["in", "notIn"].includes(props.operator)) {
      return (
        <>
          <Paper
            p={0}
            w="60%"
            style={{
              border: !props.validation?.valid ? "3px solid red" : "none",
            }}
          >
            <TextInput
              value={isDisabled ? "" : value}
              disabled={isDisabled}
              onChange={(e) => {
                setValue(e.target.value)
                onChangeDebounced(e.target.value)
              }}
            />
          </Paper>
        </>
      )
    } else {
      return (
        <Paper
          p={0}
          w="60%"
          style={{
            border: !props.validation?.valid ? "3px solid red" : "none",
          }}
        >
          <MultiSelect
            className={`${colorScheme === "light" ? "custom-react-multi-select" : "dark-custom-react-multi-select"}`}
            options={optionsWithActualValues}
            value={values}
            onChange={(selectedItems: optionType[]) =>
              onChange(selectedItems.map((item) => item.value))
            }
            disabled={isDisabled}
            labelledBy="Select"
            valueRenderer={SelectedValueRenderer}
            ItemRenderer={OptionItemRenderer}
          />
        </Paper>
      )
    }
  }

  return null
}

const RemoveRuleButton = ({ handleOnClick }: { handleOnClick: () => void }) => {
  return (
    <ActionIcon
      style={{ alignSelf: "center" }}
      aria-label="Remove rule"
      onClick={handleOnClick}
    >
      <IconXboxXFilled />
    </ActionIcon>
  )
}

export const QueryBuilder = ({
  defaultValue,
  onChange,
  queryError = false,
}: Props) => {
  const axesQuery = useAxesQuery()
  const [queryBuilderType, setQueryBuilderType] =
    useState<QueryBuilderPickerType>("regular")
  const controlElements = {
    fieldSelector: CustomFieldSelector,
    operatorSelector: CustomOperatorSelector,
    valueEditor: CustomValueEditor,
    removeRuleAction: RemoveRuleButton,
  }

  // Make sure CELQueryBuilder does not stuck in a rendering loop
  const handleQueryChange = useCallback((query: RuleGroupType | null) => {
    onChange(query)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <QueryWrapper query={axesQuery}>
      {({ data: axes }) => (
        <Stack gap={2}>
          <Paper p="xs">
            <Group justify="space-between" mb={4}>
              <Text size="sm" fw={500}>
                Where
              </Text>
              <QueryBuilderPicker
                onChange={(type) => {
                  setQueryBuilderType(type)
                }}
                current={queryBuilderType}
              />
            </Group>
            <QueryBuilderMantine>
              {queryBuilderType === "regular" && (
                <BaseQueryBuilder
                  fields={axes}
                  controlClassnames={{ rule: "base-query-builder-rule" }}
                  defaultQuery={defaultValue}
                  onQueryChange={onChange}
                  getDefaultField="cos_provider"
                  validator={(val) => queryValidator(val, [])}
                  controlElements={controlElements}
                  translations={{
                    addRule: { label: "Add a Condition" },
                    addGroup: { label: "Group Condition" },
                  }}
                />
              )}
              {queryBuilderType === "cel" && (
                <CELQueryBuilder
                  initialFields={axes}
                  onQueryChange={handleQueryChange}
                  queryError={queryError}
                  initialQuery={defaultValue}
                />
              )}
            </QueryBuilderMantine>
          </Paper>
        </Stack>
      )}
    </QueryWrapper>
  )
}
