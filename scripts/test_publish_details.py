"""Tests for the detail publishing pipeline."""

import json
import pytest
from pathlib import Path

import yaml

from publish_details import parse_markdown_body, extract_details, publish_to_dir, run


class TestParseMarkdownBody:
    def test_plain_paragraph(self):
        result = parse_markdown_body("Hello world")
        assert result == [{"text": ["Hello world"]}]

    def test_two_paragraphs(self):
        result = parse_markdown_body("First para.\n\nSecond para.")
        assert result == [
            {"text": ["First para."]},
            {"text": ["Second para."]},
        ]

    def test_bold_span(self):
        result = parse_markdown_body("Use a **Wisdom saving throw** to resist.")
        assert result == [
            {
                "text": [
                    "Use a ",
                    {"strong": "Wisdom saving throw"},
                    " to resist.",
                ]
            }
        ]

    def test_italic_span(self):
        result = parse_markdown_body("This is *emphasized* text.")
        assert result == [{"text": ["This is ", {"em": "emphasized"}, " text."]}]

    def test_mixed_bold_and_italic(self):
        result = parse_markdown_body("**Bold** and *italic* together.")
        assert result == [
            {
                "text": [
                    {"strong": "Bold"},
                    " and ",
                    {"em": "italic"},
                    " together.",
                ]
            }
        ]

    def test_bullet_line(self):
        result = parse_markdown_body("- A bullet point")
        assert result == [{"bullet": True, "text": ["A bullet point"]}]

    def test_bullet_with_bold(self):
        result = parse_markdown_body("- **Label:** description here")
        assert result == [
            {
                "bullet": True,
                "text": [{"strong": "Label:"}, " description here"],
            }
        ]

    def test_empty_body(self):
        result = parse_markdown_body("")
        assert result == []

    def test_single_newline_joins_paragraph(self):
        result = parse_markdown_body("Line one\nLine two")
        assert result == [{"text": ["Line one Line two"]}]

    def test_rejects_html_tag(self):
        with pytest.raises(ValueError, match="HTML"):
            parse_markdown_body("Text with <script>alert(1)</script> tag")

    def test_non_tag_angle_bracket_passes_through(self):
        result = parse_markdown_body("Value must be less than < 10")
        assert result == [{"text": ["Value must be less than < 10"]}]


def _make_rule_group(detail=None, **kwargs):
    """Helper to build a rule-group dict for extraction tests."""
    rg = {"id": "test-rule", "translations": {"en": {"name": "Test", "description": "desc", "keywords": ["test"]}}}
    if detail is not None:
        rg["detail"] = detail
    rg.update(kwargs)
    return {"ruleGroups": [rg]}


class TestExtractDetails:
    def test_rule_group_with_detail_produces_entry(self):
        data = _make_rule_group(detail={
            "key": "spell/sleep",
            "source": "srd52",
            "meta": "Level 1 Enchantment",
            "body": "Some text here.",
        })
        results = extract_details([data])
        assert len(results) == 1
        key, detail = results[0]
        assert key == "spell/sleep"
        assert detail["source"] == "srd52"
        assert detail["meta"] == "Level 1 Enchantment"
        assert detail["body"] == [{"text": ["Some text here."]}]

    def test_rule_group_without_detail_produces_nothing(self):
        data = _make_rule_group()
        results = extract_details([data])
        assert results == []

    def test_missing_key_raises(self):
        data = _make_rule_group(detail={"source": "srd52", "body": "Text"})
        with pytest.raises(ValueError, match="key"):
            extract_details([data])

    def test_missing_source_raises(self):
        data = _make_rule_group(detail={"key": "spell/x", "body": "Text"})
        with pytest.raises(ValueError, match="source"):
            extract_details([data])

    def test_missing_body_raises(self):
        data = _make_rule_group(detail={"key": "spell/x", "source": "srd52"})
        with pytest.raises(ValueError, match="body"):
            extract_details([data])

    def test_fields_and_meta_passed_through(self):
        fields = [{"labelKey": "rules.field.castingTime", "value": "Action"}]
        data = _make_rule_group(detail={
            "key": "spell/test",
            "source": "custom",
            "meta": "A test spell",
            "fields": fields,
            "body": "Text.",
        })
        results = extract_details([data])
        _, detail = results[0]
        assert detail["fields"] == fields
        assert detail["meta"] == "A test spell"

    def test_fields_omitted_when_absent(self):
        data = _make_rule_group(detail={
            "key": "spell/minimal",
            "source": "srd52",
            "body": "Minimal.",
        })
        results = extract_details([data])
        _, detail = results[0]
        assert "fields" not in detail
        assert "meta" not in detail


class TestPublishToDir:
    def test_writes_json_file(self, tmp_path):
        details = [("spell/sleep", {"source": "srd52", "body": [{"text": ["Hello"]}]})]
        publish_to_dir(details, tmp_path, locale="en")
        out_file = tmp_path / "en" / "spell" / "sleep.json"
        assert out_file.exists()
        data = json.loads(out_file.read_text())
        assert data["source"] == "srd52"
        assert data["body"] == [{"text": ["Hello"]}]

    def test_orphan_cleanup(self, tmp_path):
        locale_dir = tmp_path / "en" / "spell"
        locale_dir.mkdir(parents=True)
        stale = locale_dir / "old-spell.json"
        stale.write_text('{"source": "srd51"}')
        # Publish only spell/sleep — old-spell should be cleaned up
        details = [("spell/sleep", {"source": "srd52", "body": []})]
        publish_to_dir(details, tmp_path, locale="en")
        assert not stale.exists()
        assert (locale_dir / "sleep.json").exists()

    def test_preserves_current_files(self, tmp_path):
        details = [("spell/sleep", {"source": "srd52", "body": []})]
        publish_to_dir(details, tmp_path, locale="en")
        # Run again — file should still exist
        publish_to_dir(details, tmp_path, locale="en")
        assert (tmp_path / "en" / "spell" / "sleep.json").exists()


class TestRunEndToEnd:
    def test_scans_yaml_and_writes_json(self, tmp_path):
        # Create a minimal YAML rule file on disk
        data_dir = tmp_path / "data" / "spells"
        data_dir.mkdir(parents=True)
        yaml_content = {
            "ruleGroups": [
                {
                    "id": "spell-sleep",
                    "translations": {
                        "en": {"name": "Sleep", "description": "desc", "keywords": ["sleep"]}
                    },
                    "detail": {
                        "key": "spell/sleep",
                        "source": "srd52",
                        "meta": "Level 1 Enchantment",
                        "fields": [{"labelKey": "rules.field.castingTime", "value": "Action"}],
                        "body": "Creatures must make a **Wisdom save**.",
                    },
                }
            ]
        }
        (data_dir / "sleep.yaml").write_text(yaml.dump(yaml_content, default_flow_style=False))

        output_dir = tmp_path / "details"
        run(data_dir=data_dir, output_dir=output_dir)

        out_file = output_dir / "en" / "spell" / "sleep.json"
        assert out_file.exists()
        data = json.loads(out_file.read_text())
        assert data["source"] == "srd52"
        assert data["meta"] == "Level 1 Enchantment"
        assert data["fields"] == [{"labelKey": "rules.field.castingTime", "value": "Action"}]
        assert data["body"] == [{"text": ["Creatures must make a ", {"strong": "Wisdom save"}, "."]}]
