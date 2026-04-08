package main

import (
	"errors"
	"testing"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

func TestIsConditionFailure_TransactionCanceledWithConditionCheck(t *testing.T) {
	err := &types.TransactionCanceledException{
		CancellationReasons: []types.CancellationReason{
			{Code: aws.String("ConditionalCheckFailed")},
			{Code: aws.String("None")},
		},
	}
	if !isConditionFailure(err) {
		t.Error("expected TransactionCanceledException with ConditionalCheckFailed to be true")
	}
}

func TestIsConditionFailure_TransactionCanceledWithOtherReason(t *testing.T) {
	err := &types.TransactionCanceledException{
		CancellationReasons: []types.CancellationReason{
			{Code: aws.String("None")},
			{Code: aws.String("None")},
		},
	}
	if isConditionFailure(err) {
		t.Error("expected TransactionCanceledException without ConditionalCheckFailed to be false")
	}
}

func TestIsConditionFailure_ConditionalCheckFailedException(t *testing.T) {
	err := &types.ConditionalCheckFailedException{}
	if !isConditionFailure(err) {
		t.Error("expected ConditionalCheckFailedException to be true")
	}
}

func TestIsConditionFailure_OtherError(t *testing.T) {
	if isConditionFailure(errors.New("something else")) {
		t.Error("expected generic error to be false")
	}
}
